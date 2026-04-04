// ============================================
// Insurance Claims Controller
// File: backend/src/controllers/insuranceController.js
// ============================================

import { query } from '../config/database.js';
import Joi from 'joi';

const getOne = async (sql, p=[]) => (await query(sql,p)).rows?.[0] || null;
const getAll = async (sql, p=[]) => (await query(sql,p)).rows || [];
const now    = () => new Date().toISOString();
const today  = () => new Date().toISOString().split('T')[0];

// ── Validation ────────────────────────────────────────────────────────────────
const claimSchema = Joi.object({
  invoice_id:              Joi.number().required(),
  patient_id:              Joi.number().required(),
  insurance_provider:      Joi.string().required(),
  insurance_policy_number: Joi.string().optional().allow(''),
  insurance_group_number:  Joi.string().optional().allow(''),
  member_id:               Joi.string().optional().allow(''),
  claim_number:            Joi.string().optional().allow(''),
  claim_date:              Joi.date().required(),
  claim_amount:            Joi.number().min(0).required(),
  approved_amount:         Joi.number().min(0).optional(),
  patient_liability:       Joi.number().min(0).optional(),
  status:                  Joi.string().valid('Submitted','Under Review','Approved','Partially Approved','Rejected','Paid','Appealed').optional(),
  status_date:             Joi.date().optional(),
  rejection_reason:        Joi.string().optional().allow(''),
  appeal_notes:            Joi.string().optional().allow(''),
  response_date:           Joi.date().optional(),
  payment_date:            Joi.date().optional(),
  reference_number:        Joi.string().optional().allow(''),
  notes:                   Joi.string().optional().allow(''),
  diagnosis_codes:         Joi.string().optional().allow(''),
  procedure_codes:         Joi.string().optional().allow(''),
});

const statusSchema = Joi.object({
  status:            Joi.string().valid('Submitted','Under Review','Approved','Partially Approved','Rejected','Paid','Appealed').required(),
  approved_amount:   Joi.number().min(0).optional(),
  patient_liability: Joi.number().min(0).optional(),
  rejection_reason:  Joi.string().optional().allow(''),
  appeal_notes:      Joi.string().optional().allow(''),
  response_date:     Joi.date().optional(),
  payment_date:      Joi.date().optional(),
  reference_number:  Joi.string().optional().allow(''),
  notes:             Joi.string().optional().allow(''),
});

// ── GET /insurance — all claims ───────────────────────────────────────────────
export const getAllClaims = async (req, res) => {
  try {
    const { page=1, limit=10, status='', provider='', patient_id='', start_date='', end_date='' } = req.query;
    const offset = (page-1) * limit;

    let where = ['1=1'];
    let params = [];
    if (status)     { where.push('c.status = ?');                 params.push(status);     }
    if (provider)   { where.push('c.insurance_provider LIKE ?');  params.push(`%${provider}%`); }
    if (patient_id) { where.push('c.patient_id = ?');             params.push(patient_id); }
    if (start_date) { where.push('c.claim_date >= ?');            params.push(start_date); }
    if (end_date)   { where.push('c.claim_date <= ?');            params.push(end_date);   }

    const w = `WHERE ${where.join(' AND ')}`;

    const total = await getOne(`SELECT COUNT(*) AS n FROM insurance_claims c ${w}`, params);

    const rows = await getAll(`
      SELECT
        c.*,
        p.first_name, p.last_name, p.phone,
        p.insurance_provider AS patient_insurance_provider,
        i.invoice_number, i.total_amount, i.status AS invoice_status
      FROM insurance_claims c
      JOIN patients p  ON c.patient_id  = p.patient_id
      JOIN invoices i  ON c.invoice_id  = i.invoice_id
      ${w}
      ORDER BY c.claim_date DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      claims: rows,
      pagination: { page:+page, limit:+limit, total: total?.n||0, totalPages: Math.ceil((total?.n||0)/limit) },
    });
  } catch (err) {
    console.error('getAllClaims error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /insurance/stats ──────────────────────────────────────────────────────
export const getClaimStats = async (req, res) => {
  try {
    const stats = await getOne(`
      SELECT
        COUNT(*)                                                         AS total_claims,
        SUM(claim_amount)                                                AS total_claimed,
        SUM(approved_amount)                                             AS total_approved,
        SUM(patient_liability)                                           AS total_patient_liability,
        SUM(CASE WHEN status = 'Submitted'          THEN 1 ELSE 0 END)  AS submitted,
        SUM(CASE WHEN status = 'Under Review'       THEN 1 ELSE 0 END)  AS under_review,
        SUM(CASE WHEN status = 'Approved'           THEN 1 ELSE 0 END)  AS approved,
        SUM(CASE WHEN status = 'Partially Approved' THEN 1 ELSE 0 END)  AS partially_approved,
        SUM(CASE WHEN status = 'Rejected'           THEN 1 ELSE 0 END)  AS rejected,
        SUM(CASE WHEN status = 'Paid'               THEN 1 ELSE 0 END)  AS paid,
        SUM(CASE WHEN status = 'Appealed'           THEN 1 ELSE 0 END)  AS appealed,
        ROUND(
          100.0 * SUM(CASE WHEN status IN ('Approved','Partially Approved','Paid') THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1
        )                                                                AS approval_rate
      FROM insurance_claims
    `, []);

    // By provider
    const byProvider = await getAll(`
      SELECT
        insurance_provider,
        COUNT(*)           AS claims,
        SUM(claim_amount)  AS total_claimed,
        SUM(approved_amount) AS total_approved,
        ROUND(100.0 * SUM(approved_amount) / NULLIF(SUM(claim_amount),0), 1) AS approval_rate_pct
      FROM insurance_claims
      GROUP BY insurance_provider
      ORDER BY total_claimed DESC
      LIMIT 10
    `, []);

    res.json({ stats, byProvider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /insurance/:id ────────────────────────────────────────────────────────
export const getClaimById = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await getOne(`
      SELECT c.*,
        p.first_name, p.last_name, p.phone, p.email,
        p.insurance_provider AS patient_insurance_provider,
        p.insurance_policy_number AS patient_policy_number,
        i.invoice_number, i.total_amount, i.invoice_date, i.status AS invoice_status
      FROM insurance_claims c
      JOIN patients p ON c.patient_id = p.patient_id
      JOIN invoices i ON c.invoice_id = i.invoice_id
      WHERE c.claim_id = ?
    `, [id]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json({ claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /insurance/invoice/:invoiceId — claims for an invoice ─────────────────
export const getClaimsByInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const claims = await getAll(`
      SELECT c.*, p.first_name, p.last_name
      FROM insurance_claims c
      JOIN patients p ON c.patient_id = p.patient_id
      WHERE c.invoice_id = ?
      ORDER BY c.claim_date DESC
    `, [invoiceId]);
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /insurance — create claim ────────────────────────────────────────────
export const createClaim = async (req, res) => {
  try {
    const { error, value } = claimSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    // Verify invoice exists
    const invoice = await getOne('SELECT invoice_id, total_amount, patient_id FROM invoices WHERE invoice_id = ?', [value.invoice_id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Auto-generate claim number if not provided
    const claimNumber = value.claim_number || `CLM-${Date.now()}`;

    const result = await query(`
      INSERT INTO insurance_claims (
        invoice_id, patient_id, insurance_provider, insurance_policy_number,
        insurance_group_number, member_id, claim_number, claim_date, claim_amount,
        approved_amount, patient_liability, status, status_date, rejection_reason,
        appeal_notes, response_date, payment_date, reference_number,
        notes, diagnosis_codes, procedure_codes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      value.invoice_id, value.patient_id, value.insurance_provider,
      value.insurance_policy_number||null, value.insurance_group_number||null,
      value.member_id||null, claimNumber, value.claim_date,
      value.claim_amount, value.approved_amount||0, value.patient_liability||0,
      value.status||'Submitted', value.status_date||today(), value.rejection_reason||null,
      value.appeal_notes||null, value.response_date||null, value.payment_date||null,
      value.reference_number||null, value.notes||null,
      value.diagnosis_codes||null, value.procedure_codes||null,
      req.user?.user_id||null, now(), now(),
    ]);

    const newClaim = await getOne('SELECT * FROM insurance_claims WHERE claim_id = ?', [result.lastID]);
    res.status(201).json({ message: 'Insurance claim created successfully', claim: newClaim, claim_number: claimNumber });
  } catch (err) {
    console.error('createClaim error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /insurance/:id/status — update claim status ───────────────────────────
export const updateClaimStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = statusSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const claim = await getOne('SELECT * FROM insurance_claims WHERE claim_id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    await query(`
      UPDATE insurance_claims SET
        status           = ?,
        approved_amount  = COALESCE(?, approved_amount),
        patient_liability = COALESCE(?, patient_liability),
        rejection_reason = COALESCE(?, rejection_reason),
        appeal_notes     = COALESCE(?, appeal_notes),
        response_date    = COALESCE(?, response_date),
        payment_date     = COALESCE(?, payment_date),
        reference_number = COALESCE(?, reference_number),
        notes            = COALESCE(?, notes),
        status_date      = ?,
        updated_by       = ?,
        updated_at       = ?
      WHERE claim_id = ?
    `, [
      value.status,
      value.approved_amount??null, value.patient_liability??null,
      value.rejection_reason||null, value.appeal_notes||null,
      value.response_date||null, value.payment_date||null,
      value.reference_number||null, value.notes||null,
      today(), req.user?.user_id||null, now(), id,
    ]);

    // If claim is Paid → record a payment on the invoice automatically
    if (value.status === 'Paid' && value.approved_amount > 0) {
      try {
        const invoice = await getOne('SELECT * FROM invoices WHERE invoice_id = ?', [claim.invoice_id]);
        if (invoice) {
          const newPaid  = (invoice.amount_paid||0) + value.approved_amount;
          const newDue   = Math.max(0, invoice.total_amount - newPaid);
          const newStatus = newDue <= 0 ? 'Paid' : 'Partially Paid';

          await query(`
            INSERT INTO payments (invoice_id, patient_id, payment_date, amount_paid, payment_method, reference_number, notes, received_by)
            VALUES (?, ?, ?, ?, 'Other', ?, ?, ?)
          `, [
            claim.invoice_id, claim.patient_id, today(),
            value.approved_amount, claim.claim_number || 'Insurance',
            `Insurance payment — ${claim.insurance_provider}`,
            req.user?.user_id||null,
          ]);

          await query(
            'UPDATE invoices SET amount_paid=?, amount_due=?, status=?, updated_at=? WHERE invoice_id=?',
            [newPaid, newDue, newStatus, now(), claim.invoice_id]
          );
        }
      } catch (payErr) {
        console.error('Auto-payment on insurance claim failed:', payErr.message);
        // Don't fail the status update if auto-payment fails
      }
    }

    const updated = await getOne(`
      SELECT c.*, p.first_name, p.last_name, i.invoice_number
      FROM insurance_claims c
      JOIN patients p ON c.patient_id = p.patient_id
      JOIN invoices i ON c.invoice_id = i.invoice_id
      WHERE c.claim_id = ?
    `, [id]);

    res.json({ message: `Claim status updated to ${value.status}`, claim: updated });
  } catch (err) {
    console.error('updateClaimStatus error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /insurance/:id — update claim details ─────────────────────────────────
export const updateClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = claimSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const claim = await getOne('SELECT claim_id FROM insurance_claims WHERE claim_id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    await query(`
      UPDATE insurance_claims SET
        insurance_provider      = ?, insurance_policy_number = ?,
        insurance_group_number  = ?, member_id               = ?,
        claim_number            = ?, claim_date              = ?,
        claim_amount            = ?, approved_amount         = ?,
        patient_liability       = ?, status                  = ?,
        rejection_reason        = ?, appeal_notes            = ?,
        notes                   = ?, diagnosis_codes         = ?,
        procedure_codes         = ?, updated_by              = ?,
        updated_at              = ?
      WHERE claim_id = ?
    `, [
      value.insurance_provider, value.insurance_policy_number||null,
      value.insurance_group_number||null, value.member_id||null,
      value.claim_number||null, value.claim_date,
      value.claim_amount, value.approved_amount||0,
      value.patient_liability||0, value.status||'Submitted',
      value.rejection_reason||null, value.appeal_notes||null,
      value.notes||null, value.diagnosis_codes||null,
      value.procedure_codes||null, req.user?.user_id||null,
      now(), id,
    ]);

    const updated = await getOne('SELECT * FROM insurance_claims WHERE claim_id = ?', [id]);
    res.json({ message: 'Claim updated successfully', claim: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /insurance/:id ─────────────────────────────────────────────────────
export const deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await getOne('SELECT claim_id, status FROM insurance_claims WHERE claim_id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (['Paid','Approved'].includes(claim.status))
      return res.status(400).json({ error: `Cannot delete a ${claim.status} claim` });

    await query('DELETE FROM insurance_claims WHERE claim_id = ?', [id]);
    res.json({ message: 'Claim deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};