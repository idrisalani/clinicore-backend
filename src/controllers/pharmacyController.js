// ============================================
// Pharmacy Controller — COMPLETE UPDATED FILE
// File: backend/src/controllers/pharmacyController.js
// ============================================

import { query } from '../config/database.js';
import Joi from 'joi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getOne = async (sql, params = []) => (await query(sql, params)).rows?.[0] || null;
const getAll = async (sql, params = []) => (await query(sql, params)).rows || [];

// ==========================================
// Validation Schemas
// ==========================================

const prescriptionSchema = Joi.object({
  patient_id: Joi.number().required(),
  consultation_id: Joi.number().optional(),
  doctor_id: Joi.number().optional(),
  medication_id: Joi.number().required(),
  prescription_date: Joi.date().required(),
  prescribed_dosage: Joi.string().required(),
  frequency: Joi.string().required(),
  duration_days: Joi.number().optional(),
  quantity: Joi.number().required(),
  refills_remaining: Joi.number().optional(),
  instructions: Joi.string().optional(),
  special_instructions: Joi.string().optional(),
  status: Joi.string().valid('Active','Completed','Cancelled','Suspended').optional(),
  expiry_date: Joi.date().optional(),
  notes: Joi.string().optional(),
});

const medicationSchema = Joi.object({
  generic_name: Joi.string().required(),
  brand_name: Joi.string().optional(),
  drug_code: Joi.string().optional(),
  drug_class: Joi.string().optional(),
  strength: Joi.string().optional(),
  unit: Joi.string().optional(),
  default_dosage: Joi.string().optional(),
  default_frequency: Joi.string().optional(),
  unit_cost: Joi.number().optional(),
  is_active: Joi.number().optional(),
});

const inventorySchema = Joi.object({
  stock_quantity:    Joi.number().integer().min(0).optional(),
  reorder_level:     Joi.number().integer().min(0).optional(),
  expiry_date:       Joi.string().optional(),
  batch_number:      Joi.string().optional(),
  supplier_name:     Joi.string().optional(),
  supplier_phone:    Joi.string().optional(),
  supplier_email:    Joi.string().email().optional(),
  storage_location:  Joi.string().optional(),
  last_restocked_at: Joi.string().optional(),
});

// ==========================================
// PRESCRIPTIONS
// ==========================================

export const getAllPrescriptions = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];
    if (patient_id) { whereClause += ' AND p.patient_id = ?'; params.push(patient_id); }
    if (status)     { whereClause += ' AND p.status = ?';     params.push(status);     }

    const countResult = await query(`SELECT COUNT(*) as total FROM prescriptions p ${whereClause}`, params);
    const total = countResult.rows[0]?.total || 0;

    const prescriptionsResult = await query(
      `SELECT p.*, pat.first_name, pat.last_name, m.generic_name, m.brand_name
       FROM prescriptions p
       JOIN patients pat ON p.patient_id = pat.patient_id
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       ${whereClause} ORDER BY p.prescription_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      prescriptions: prescriptionsResult.rows || [],
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*, pat.first_name, pat.last_name, pat.phone, m.generic_name, m.brand_name, m.drug_class
       FROM prescriptions p
       JOIN patients pat ON p.patient_id = pat.patient_id
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       WHERE p.prescription_id = ?`, [id]
    );
    if (!result.rows?.length) return res.status(404).json({ error: 'Prescription not found' });
    res.json({ prescription: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
};

export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      `SELECT p.*, m.generic_name, m.brand_name, m.drug_class
       FROM prescriptions p
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       WHERE p.patient_id = ? ORDER BY p.prescription_date DESC`, [patientId]
    );
    res.json({ prescriptions: result.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
};

export const createPrescription = async (req, res) => {
  try {
    const { error, value } = prescriptionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { patient_id, consultation_id, doctor_id, medication_id, prescription_date,
      prescribed_dosage, frequency, duration_days, quantity, refills_remaining,
      instructions, special_instructions, status, expiry_date, notes } = value;

    const result = await query(
      `INSERT INTO prescriptions (
        patient_id, consultation_id, doctor_id, medication_id, prescription_date,
        prescribed_dosage, frequency, duration_days, quantity, refills_remaining,
        instructions, special_instructions, status, expiry_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, consultation_id||null, doctor_id||req.user.user_id, medication_id,
       prescription_date, prescribed_dosage, frequency, duration_days||null, quantity,
       refills_remaining||0, instructions||null, special_instructions||null,
       status||'Active', expiry_date||null, notes||null, req.user.user_id]
    );
    res.status(201).json({ message: 'Prescription created successfully', prescription_id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create prescription' });
  }
};

export const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = prescriptionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const existing = await getOne('SELECT prescription_id FROM prescriptions WHERE prescription_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Prescription not found' });

    const { patient_id, consultation_id, doctor_id, medication_id, prescription_date,
      prescribed_dosage, frequency, duration_days, quantity, refills_remaining,
      instructions, special_instructions, status, expiry_date, notes } = value;

    await query(
      `UPDATE prescriptions SET patient_id=?, consultation_id=?, doctor_id=?,
        medication_id=?, prescription_date=?, prescribed_dosage=?, frequency=?,
        duration_days=?, quantity=?, refills_remaining=?, instructions=?,
        special_instructions=?, status=?, expiry_date=?, notes=?,
        updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE prescription_id=?`,
      [patient_id, consultation_id||null, doctor_id||req.user.user_id, medication_id,
       prescription_date, prescribed_dosage, frequency, duration_days||null, quantity,
       refills_remaining||0, instructions||null, special_instructions||null,
       status||'Active', expiry_date||null, notes||null, req.user.user_id, id]
    );
    res.json({ message: 'Prescription updated successfully', prescription_id: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update prescription' });
  }
};

export const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM prescriptions WHERE prescription_id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Prescription not found' });
    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete prescription' });
  }
};

// ==========================================
// MEDICATIONS
// ==========================================

export const getAllMedications = async (req, res) => {
  try {
    const { search = '', is_active = 1 } = req.query;
    let whereClause = 'WHERE is_active = ?';
    let params = [is_active];
    if (search) {
      whereClause += ' AND (generic_name LIKE ? OR brand_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const result = await query(`SELECT * FROM medication_catalog ${whereClause} ORDER BY generic_name`, params);
    res.json({ medications: result.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
};

export const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM medication_catalog WHERE medication_id = ?', [id]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Medication not found' });
    res.json({ medication: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
};

export const createMedication = async (req, res) => {
  try {
    const { error, value } = medicationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { generic_name, brand_name, drug_code, drug_class, strength, unit,
      default_dosage, default_frequency, unit_cost, is_active } = value;

    const result = await query(
      `INSERT INTO medication_catalog (generic_name, brand_name, drug_code, drug_class,
        strength, unit, default_dosage, default_frequency, unit_cost, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generic_name, brand_name||null, drug_code||null, drug_class||null,
       strength||null, unit||null, default_dosage||null, default_frequency||null,
       unit_cost||null, is_active !== undefined ? is_active : 1]
    );
    res.status(201).json({ message: 'Medication created successfully', medication_id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create medication' });
  }
};

// ==========================================
// PHARMACY STATISTICS (existing)
// ==========================================

export const getPharmacyStats = async (req, res) => {
  try {
    const [total, active, byStatus, totalMeds, refills] = await Promise.all([
      query('SELECT COUNT(*) as total FROM prescriptions'),
      query("SELECT COUNT(*) as total FROM prescriptions WHERE status = 'Active'"),
      query('SELECT status, COUNT(*) as count FROM prescriptions GROUP BY status'),
      query('SELECT COUNT(*) as total FROM medication_catalog WHERE is_active = 1'),
      query("SELECT COUNT(*) as total FROM prescriptions WHERE status = 'Active' AND refills_remaining < 5"),
    ]);

    const stats = {
      total_prescriptions:       total.rows[0]?.total    || 0,
      active_prescriptions:      active.rows[0]?.total   || 0,
      total_medications:         totalMeds.rows[0]?.total || 0,
      medications_needing_refill: refills.rows[0]?.total  || 0,
      by_status: {},
    };
    byStatus.rows?.forEach(r => { stats.by_status[r.status] = r.count; });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// ==========================================
// DRUG EXPIRY & INVENTORY (NEW)
// ==========================================

export const getMedicationExpiry = async (req, res) => {
  try {
    const { status = '', search = '' } = req.query;
    const today    = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
    const in90Days = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];

    let where  = ['is_active = 1'];
    let params = [];

    if (status === 'expired')       { where.push('expiry_date < ?');                            params.push(today);          }
    if (status === 'expiring_soon') { where.push('expiry_date >= ? AND expiry_date <= ?');       params.push(today, in30Days); }
    if (status === 'ok')            { where.push('(expiry_date > ? OR expiry_date IS NULL)');    params.push(in30Days);        }

    if (search) {
      where.push('(generic_name LIKE ? OR brand_name LIKE ? OR batch_number LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await getAll(`
      SELECT *,
        CASE
          WHEN expiry_date IS NULL     THEN 'no_date'
          WHEN expiry_date < ?         THEN 'expired'
          WHEN expiry_date <= ?        THEN 'expiring_soon'
          WHEN expiry_date <= ?        THEN 'expiring_90days'
          ELSE 'ok'
        END AS expiry_status,
        CAST(julianday(expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry
      FROM medication_catalog
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC
    `, [today, in30Days, in90Days, ...params]);

    const summary = await getOne(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN expiry_date < ?                              THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ?        THEN 1 ELSE 0 END) AS expiring_soon,
        SUM(CASE WHEN expiry_date > ? AND expiry_date <= ?         THEN 1 ELSE 0 END) AS expiring_90days,
        SUM(CASE WHEN expiry_date > ? OR expiry_date IS NULL       THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN stock_quantity <= reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END) AS low_stock,
        SUM(CASE WHEN stock_quantity = 0                           THEN 1 ELSE 0 END) AS out_of_stock
      FROM medication_catalog WHERE is_active = 1
    `, [today, today, in30Days, in30Days, in90Days, in90Days]);

    res.json({ medications: rows, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateMedicationInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = inventorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const existing = await getOne('SELECT * FROM medication_catalog WHERE medication_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Medication not found' });

    const { stock_quantity, reorder_level, expiry_date, batch_number,
      supplier_name, supplier_phone, supplier_email,
      storage_location, last_restocked_at } = value;

    await query(`
      UPDATE medication_catalog SET
        stock_quantity    = COALESCE(?, stock_quantity),
        reorder_level     = COALESCE(?, reorder_level),
        expiry_date       = COALESCE(?, expiry_date),
        batch_number      = COALESCE(?, batch_number),
        supplier_name     = COALESCE(?, supplier_name),
        supplier_phone    = COALESCE(?, supplier_phone),
        supplier_email    = COALESCE(?, supplier_email),
        storage_location  = COALESCE(?, storage_location),
        last_restocked_at = COALESCE(?, last_restocked_at),
        updated_at        = CURRENT_TIMESTAMP
      WHERE medication_id = ?
    `, [stock_quantity??null, reorder_level??null, expiry_date??null,
        batch_number??null, supplier_name??null, supplier_phone??null,
        supplier_email??null, storage_location??null, last_restocked_at??null, id]);

    const updated = await getOne('SELECT * FROM medication_catalog WHERE medication_id = ?', [id]);
    res.json({ message: 'Inventory updated successfully', medication: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLowStockMedications = async (req, res) => {
  try {
    const rows = await getAll(`
      SELECT *,
        CAST(julianday(expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry
      FROM medication_catalog
      WHERE is_active = 1 AND reorder_level > 0 AND stock_quantity <= reorder_level
      ORDER BY stock_quantity ASC
    `, []);
    res.json({ medications: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};