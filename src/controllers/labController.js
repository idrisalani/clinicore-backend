// ============================================
// labController.js
// File: backend/src/controllers/labController.js
// ============================================

import { query } from '../config/database.js';
import Joi from 'joi';

// ── Validation Schemas ────────────────────────────────────────────────────────

const labOrderSchema = Joi.object({
  patient_id:      Joi.number().integer().required().messages({
    'number.base':  'Patient ID must be a number',
    'any.required': 'Patient is required',
  }),
  consultation_id: Joi.number().integer().optional().allow(null, ''),
  doctor_id:       Joi.number().integer().optional().allow(null, ''),
  test_type:       Joi.string().trim().required().messages({
    'string.empty': 'Test type is required',
    'any.required': 'Test type is required',
  }),
  test_code:       Joi.string().trim().optional().allow(null, ''),
  test_name:       Joi.string().trim().required().messages({
    'string.empty': 'Test name is required',
    'any.required': 'Test name is required',
  }),
  specimen_type:   Joi.string().trim().optional().allow(null, ''),
  priority:        Joi.string().valid('Routine', 'Urgent', 'Stat').optional().default('Routine'),
  instructions:    Joi.string().trim().optional().allow(null, ''),
  ordered_date:    Joi.string().optional().allow(null, ''),  // SQLite stores as TEXT — keep as string
  expected_date:   Joi.string().optional().allow(null, ''),
  status:          Joi.string().valid('Ordered', 'In Progress', 'Completed', 'Cancelled', 'Pending').optional().default('Ordered'),
  notes:           Joi.string().trim().optional().allow(null, ''),
}).options({ stripUnknown: true, convert: true });
// stripUnknown: silently drops any extra fields the frontend sends
// convert: true:  coerces "1" → 1 for number fields automatically

const labResultSchema = Joi.object({
  lab_order_id:    Joi.number().integer().optional().allow(null, ''), // sent in URL, not body — keep optional
  result_value:    Joi.string().trim().required().messages({
    'string.empty': 'Result value is required',
    'any.required': 'Result value is required',
  }),
  unit:            Joi.string().trim().optional().allow(null, ''),
  reference_range: Joi.string().trim().optional().allow(null, ''),
  result_status:   Joi.string().valid('Normal', 'Abnormal', 'Critical', 'Pending').optional().default('Pending'),
  interpretation:  Joi.string().trim().optional().allow(null, ''),
  test_date:       Joi.string().optional().allow(null, ''),
  completion_date: Joi.string().optional().allow(null, ''),
  performed_by:    Joi.string().trim().optional().allow(null, ''),
  notes:           Joi.string().trim().optional().allow(null, ''),
}).options({ stripUnknown: true, convert: true });

// ── Helper: coerce empty strings to null for DB insert ───────────────────────
const n = (v) => (v === '' || v === undefined) ? null : v;

// ── GET /lab — All Lab Orders with Pagination ─────────────────────────────────
export const getAllLabOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) { whereClause += ' AND lo.patient_id = ?'; params.push(patient_id); }
    if (status)     { whereClause += ' AND lo.status = ?';     params.push(status); }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM lab_orders lo ${whereClause}`, params
    );
    const total = countResult.rows[0]?.total || 0;

    const ordersResult = await query(
      `SELECT lo.*, p.first_name, p.last_name, p.phone,
              (SELECT COUNT(*) FROM lab_results WHERE lab_order_id = lo.lab_order_id) as result_count
       FROM lab_orders lo
       JOIN patients p ON lo.patient_id = p.patient_id
       ${whereClause}
       ORDER BY lo.ordered_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      orders: ordersResult.rows || [],
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting lab orders:', error);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
};

// ── GET /lab/:id — Single Lab Order with Results ──────────────────────────────
export const getLabOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await query(
      `SELECT lo.*, p.first_name, p.last_name, p.phone
       FROM lab_orders lo
       JOIN patients p ON lo.patient_id = p.patient_id
       WHERE lo.lab_order_id = ?`,
      [id]
    );

    if (!orderResult.rows?.length) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const resultsResult = await query(
      `SELECT * FROM lab_results WHERE lab_order_id = ? ORDER BY test_date DESC`, [id]
    );

    res.json({ order: orderResult.rows[0], results: resultsResult.rows || [] });
  } catch (error) {
    console.error('❌ Error getting lab order:', error);
    res.status(500).json({ error: 'Failed to fetch lab order' });
  }
};

// ── GET /lab/patient/:patientId ───────────────────────────────────────────────
export const getPatientLabOrders = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    const result = await query(
      `SELECT lo.*,
              (SELECT COUNT(*) FROM lab_results WHERE lab_order_id = lo.lab_order_id) as result_count
       FROM lab_orders lo
       WHERE lo.patient_id = ?
       ORDER BY lo.ordered_date DESC
       LIMIT ?`,
      [patientId, limit]
    );

    res.json({ orders: result.rows || [] });
  } catch (error) {
    console.error('❌ Error getting patient lab orders:', error);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
};

// ── POST /lab — Create Lab Order ──────────────────────────────────────────────
export const createLabOrder = async (req, res) => {
  try {
    const { error, value } = labOrderSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      patient_id, consultation_id, doctor_id,
      test_type, test_code, test_name,
      specimen_type, priority, instructions,
      ordered_date, expected_date, status, notes,
    } = value;

    const result = await query(
      `INSERT INTO lab_orders (
        patient_id, consultation_id, doctor_id, test_type, test_code,
        test_name, specimen_type, priority, instructions,
        ordered_date, expected_date, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        n(consultation_id),
        n(doctor_id),
        test_type,
        n(test_code),
        test_name,
        n(specimen_type),
        priority  || 'Routine',
        n(instructions),
        ordered_date || new Date().toISOString().split('T')[0],
        n(expected_date),
        status    || 'Ordered',
        n(notes),
        req.user.user_id,
      ]
    );

    console.log(`✅ Lab order created: ID ${result.lastID}`);
    res.status(201).json({ message: 'Lab order created successfully', lab_order_id: result.lastID });
  } catch (error) {
    console.error('❌ Error creating lab order:', error);
    res.status(500).json({ error: 'Failed to create lab order' });
  }
};

// ── PUT /lab/:id — Update Lab Order ──────────────────────────────────────────
export const updateLabOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = labOrderSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = await query(
      'SELECT lab_order_id FROM lab_orders WHERE lab_order_id = ?', [id]
    );
    if (!existing.rows?.length) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const {
      patient_id, consultation_id, doctor_id,
      test_type, test_code, test_name,
      specimen_type, priority, instructions,
      ordered_date, expected_date, status, notes,
    } = value;

    await query(
      `UPDATE lab_orders SET
        patient_id = ?, consultation_id = ?, doctor_id = ?,
        test_type = ?, test_code = ?, test_name = ?,
        specimen_type = ?, priority = ?, instructions = ?,
        ordered_date = ?, expected_date = ?, status = ?,
        notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE lab_order_id = ?`,
      [
        patient_id,
        n(consultation_id),
        n(doctor_id),
        test_type,
        n(test_code),
        test_name,
        n(specimen_type),
        priority  || 'Routine',
        n(instructions),
        ordered_date || new Date().toISOString().split('T')[0],
        n(expected_date),
        status    || 'Ordered',
        n(notes),
        req.user.user_id,
        id,
      ]
    );

    console.log(`✅ Lab order updated: ${id}`);
    res.json({ message: 'Lab order updated successfully', lab_order_id: id });
  } catch (error) {
    console.error('❌ Error updating lab order:', error);
    res.status(500).json({ error: 'Failed to update lab order' });
  }
};

// ── DELETE /lab/:id ───────────────────────────────────────────────────────────
export const deleteLabOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM lab_orders WHERE lab_order_id = ?`, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    console.log(`✅ Lab order deleted: ${id}`);
    res.json({ message: 'Lab order deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting lab order:', error);
    res.status(500).json({ error: 'Failed to delete lab order' });
  }
};

// ── POST /lab/:id/results — Add Lab Result ────────────────────────────────────
export const addLabResult = async (req, res) => {
  try {
    const { id: lab_order_id } = req.params;           // get order ID from URL
    const { error, value } = labResultSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      result_value, unit, reference_range, result_status,
      interpretation, test_date, completion_date, performed_by, notes,
    } = value;

    const result = await query(
      `INSERT INTO lab_results (
        lab_order_id, result_value, unit, reference_range,
        result_status, interpretation, test_date, completion_date,
        performed_by, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lab_order_id,
        result_value,
        n(unit),
        n(reference_range),
        result_status || 'Pending',
        n(interpretation),
        test_date || new Date().toISOString().split('T')[0],
        n(completion_date),
        n(performed_by),
        n(notes),
        req.user.user_id,
      ]
    );

    // Auto-complete the order
    await query(
      `UPDATE lab_orders SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE lab_order_id = ?`,
      [lab_order_id]
    );

    console.log(`✅ Lab result added: ID ${result.lastID}`);
    res.status(201).json({ message: 'Lab result added successfully', result_id: result.lastID });
  } catch (error) {
    console.error('❌ Error adding lab result:', error);
    res.status(500).json({ error: 'Failed to add lab result' });
  }
};

// ── GET /lab/stats/overview ───────────────────────────────────────────────────
export const getLabStats = async (req, res) => {
  try {
    const [totalRes, statusRes, resultsRes, pendingRes] = await Promise.all([
      query('SELECT COUNT(*) as total FROM lab_orders'),
      query('SELECT status, COUNT(*) as count FROM lab_orders GROUP BY status'),
      query('SELECT COUNT(*) as total FROM lab_results'),
      query(`SELECT COUNT(*) as total FROM lab_results WHERE result_status = 'Pending'`),
    ]);

    const by_status = {};
    statusRes.rows?.forEach(r => { by_status[r.status] = r.count; });

    res.json({
      total_orders:    totalRes.rows[0]?.total   || 0,
      by_status,
      total_results:   resultsRes.rows[0]?.total || 0,
      pending_results: pendingRes.rows[0]?.total || 0,
    });
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};