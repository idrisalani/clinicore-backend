// ============================================
// billingController.js
// File: backend/src/controllers/billingController.js
// ============================================
import { query } from '../config/database.js';
import Joi from 'joi';
import {
  sendPaymentConfirmation,
  sendInvoiceNotification,
  logNotification,
} from '../services/notificationService.js';

const n   = (v) => (v === '' || v === undefined) ? null : v;
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── Notification triggers ─────────────────────────────────────────────────────
const triggerInvoiceNotification = async (invoiceId, patientId) => {
  const result = await query(
    `SELECT p.first_name, p.last_name, p.phone, p.email,
            i.invoice_number, i.total_amount, i.amount_due
     FROM patients p JOIN invoices i ON i.invoice_id = ?
     WHERE p.patient_id = ?`,
    [invoiceId, patientId]
  );
  const r = result.rows?.[0];
  if (!r) return;
  await sendInvoiceNotification({
    patientName:   `${r.first_name} ${r.last_name}`,
    patientPhone:  r.phone,
    patientEmail:  r.email,
    invoiceNumber: r.invoice_number,
    totalAmount:   r.total_amount,
    amountDue:     r.amount_due,
  });
  await logNotification(query, {
    patient_id:   patientId,
    type:         'invoice',
    channel:      r.phone && r.email ? 'both' : r.phone ? 'sms' : 'email',
    recipient:    r.phone || r.email,
    body:         `Invoice ${r.invoice_number} issued — ₦${Number(r.total_amount).toLocaleString('en-NG')}`,
    status:       'sent',
    reference_id: String(invoiceId),
  });
};

const triggerPaymentConfirmation = async (invoiceId, patientId, amountPaid, remainingBalance) => {
  const result = await query(
    `SELECT p.first_name, p.last_name, p.phone, p.email, i.invoice_number
     FROM patients p JOIN invoices i ON i.invoice_id = ?
     WHERE p.patient_id = ?`,
    [invoiceId, patientId]
  );
  const r = result.rows?.[0];
  if (!r) return;
  await sendPaymentConfirmation({
    patientName:      `${r.first_name} ${r.last_name}`,
    patientPhone:     r.phone,
    patientEmail:     r.email,
    invoiceNumber:    r.invoice_number || `INV-${invoiceId}`,
    amountPaid,
    remainingBalance,
  });
  await logNotification(query, {
    patient_id:   patientId,
    type:         'payment',
    channel:      r.phone && r.email ? 'both' : r.phone ? 'sms' : 'email',
    recipient:    r.phone || r.email,
    body:         `Payment ₦${Number(amountPaid).toLocaleString('en-NG')} confirmed`,
    status:       'sent',
    reference_id: String(invoiceId),
  });
};

// ── Validation ────────────────────────────────────────────────────────────────
const invoiceSchema = Joi.object({
  patient_id:          Joi.number().integer().required(),
  consultation_id:     Joi.number().integer().optional().allow(null, ''),
  invoice_date:        Joi.string().optional(),
  due_date:            Joi.string().optional().allow(null, ''),
  items:               Joi.array().items(Joi.object({
    description:  Joi.string().required(),
    quantity:     Joi.number().min(1).default(1),
    unit_price:   Joi.number().min(0).required(),
    category:     Joi.string().optional().allow(null, ''),
  })).min(1).required(),
  discount_amount:     Joi.number().min(0).optional().default(0),
  notes:               Joi.string().optional().allow(null, ''),
  insurance_provider:  Joi.string().optional().allow(null, ''),
  insurance_policy_number: Joi.string().optional().allow(null, ''),
});

const paymentSchema = Joi.object({
  invoice_id:      Joi.number().integer().required(),
  patient_id:      Joi.number().integer().required(),
  amount_paid:     Joi.number().min(0.01).required(),
  payment_method:  Joi.string().valid('Cash','Card','Transfer','Insurance','Other').required(),
  payment_date:    Joi.string().optional(),
  reference_number:Joi.string().optional().allow(null, ''),
  notes:           Joi.string().optional().allow(null, ''),
});

// ── GET /billing/invoices ─────────────────────────────────────────────────────
export const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, patient_id, status, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (patient_id) { where.push('i.patient_id = ?');    params.push(patient_id); }
    if (status)     { where.push('i.status = ?');        params.push(status);     }
    if (start_date) { where.push('i.invoice_date >= ?'); params.push(start_date); }
    if (end_date)   { where.push('i.invoice_date <= ?'); params.push(end_date);   }
    const w = `WHERE ${where.join(' AND ')}`;

    const total = await getOne(`SELECT COUNT(*) AS n FROM invoices i ${w}`, params);
    const rows  = await getAll(
      `SELECT i.*,
              p.first_name, p.last_name, p.phone
       FROM invoices i
       JOIN patients p ON i.patient_id = p.patient_id
       ${w}
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      invoices: rows,
      pagination: {
        total: total?.n || 0, page: +page, limit: +limit,
        totalPages: Math.ceil((total?.n || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/invoices/:id ─────────────────────────────────────────────────
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await getOne(
      `SELECT i.*, p.first_name, p.last_name, p.phone, p.email
       FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
       WHERE i.invoice_id = ?`,
      [req.params.id]
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const items    = await getAll('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    const payments = await getAll('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [req.params.id]);
    res.json({ invoice, items, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /billing/invoices ────────────────────────────────────────────────────
export const createInvoice = async (req, res) => {
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      patient_id, consultation_id, invoice_date, due_date, items,
      discount_amount, notes, insurance_provider, insurance_policy_number,
    } = value;

    // Generate invoice number
    const countRes     = await getOne('SELECT COUNT(*) AS n FROM invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String((countRes?.n || 0) + 1).padStart(4, '0')}`;

    // Calculate totals
    const subtotal    = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const totalAmount = Math.max(0, subtotal - (discount_amount || 0));

    const result = await query(
      `INSERT INTO invoices (
        patient_id, consultation_id, invoice_number, invoice_date, due_date,
        subtotal, discount_amount, total_amount, amount_paid, amount_due, status,
        notes, insurance_provider, insurance_policy_number, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Issued', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        patient_id, n(consultation_id), invoiceNumber,
        invoice_date || today(), n(due_date),
        subtotal, discount_amount || 0, totalAmount, totalAmount,
        n(notes), n(insurance_provider), n(insurance_policy_number),
        req.user.user_id,
      ]
    );

    // Insert line items
    for (const item of items) {
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.lastID, item.description, item.quantity || 1, item.unit_price,
         (item.quantity || 1) * item.unit_price, n(item.category)]
      );
    }

    console.log(`✅ Invoice created: ${invoiceNumber}`);
    res.status(201).json({
      message:        'Invoice created successfully',
      invoice_id:     result.lastID,
      invoice_number: invoiceNumber,
      total_amount:   totalAmount,
    });

    // Fire-and-forget — notify patient invoice was issued
    triggerInvoiceNotification(result.lastID, patient_id)
      .catch(e => console.warn('Invoice notification failed (non-critical):', e.message));
  } catch (err) {
    console.error('createInvoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// ── POST /billing/payments ────────────────────────────────────────────────────
export const recordPayment = async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { invoice_id, patient_id, amount_paid, payment_method, payment_date, reference_number, notes } = value;

    const invoice = await getOne('SELECT * FROM invoices WHERE invoice_id = ?', [invoice_id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const newAmountPaid = (invoice.amount_paid || 0) + amount_paid;
    const newAmountDue  = Math.max(0, invoice.total_amount - newAmountPaid);
    const newStatus     = newAmountDue <= 0 ? 'Paid'
                        : newAmountPaid > 0  ? 'Partially Paid'
                        : 'Issued';

    // Generate receipt number
    const countRes     = await getOne('SELECT COUNT(*) AS n FROM payments');
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String((countRes?.n || 0) + 1).padStart(4, '0')}`;

    const result = await query(
      `INSERT INTO payments (
        invoice_id, patient_id, payment_date, amount_paid,
        payment_method, reference_number, notes, received_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        invoice_id, patient_id, payment_date || today(),
        amount_paid, payment_method, n(reference_number), n(notes), req.user.user_id,
      ]
    );

    // Update invoice totals
    await query(
      `UPDATE invoices SET
        amount_paid = ?, amount_due = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = ?`,
      [newAmountPaid, newAmountDue, newStatus, invoice_id]
    );

    console.log(`✅ Payment recorded: ${receiptNumber}`);
    res.status(201).json({
      message:        'Payment recorded successfully',
      payment_id:     result.lastID,
      receipt_number: receiptNumber,
      amount_paid,
      invoice_status: newStatus,
      amount_due:     newAmountDue,
    });

    // Fire-and-forget — confirm payment to patient
    triggerPaymentConfirmation(invoice_id, patient_id, amount_paid, newAmountDue)
      .catch(e => console.warn('Payment notification failed (non-critical):', e.message));
  } catch (err) {
    console.error('recordPayment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

// ── GET /billing/stats ────────────────────────────────────────────────────────
export const getBillingStats = async (req, res) => {
  try {
    const [inv, pay] = await Promise.all([
      getOne(`
        SELECT
          COUNT(*)                                                 AS total_invoices,
          SUM(total_amount)                                        AS total_billed,
          SUM(amount_paid)                                         AS total_collected,
          SUM(amount_due)                                          AS total_outstanding,
          SUM(CASE WHEN status = 'Paid'         THEN 1 ELSE 0 END) AS paid_count,
          SUM(CASE WHEN status = 'Partially Paid'THEN 1 ELSE 0 END) AS partial_count,
          SUM(CASE WHEN status = 'Overdue'       THEN 1 ELSE 0 END) AS overdue_count
        FROM invoices`
      ),
      getOne(`
        SELECT
          COUNT(*)         AS total_payments,
          SUM(amount_paid) AS total_received,
          payment_method
        FROM payments
        WHERE payment_date >= date('now', '-30 days')`
      ),
    ]);
    res.json({ invoices: inv || {}, payments: pay || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/payments ─────────────────────────────────────────────────────
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, patient_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (patient_id) { where.push('pay.patient_id = ?');   params.push(patient_id); }
    if (start_date) { where.push('pay.payment_date >= ?');params.push(start_date); }
    if (end_date)   { where.push('pay.payment_date <= ?');params.push(end_date);   }
    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM payments pay ${w}`, params);
    const rows  = await getAll(
      `SELECT pay.*,
              p.first_name, p.last_name,
              i.invoice_number
       FROM payments pay
       JOIN patients p ON pay.patient_id = p.patient_id
       JOIN invoices i ON pay.invoice_id = i.invoice_id
       ${w}
       ORDER BY pay.payment_date DESC, pay.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      payments: rows,
      pagination: { total: total?.n || 0, page: +page, limit: +limit },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};