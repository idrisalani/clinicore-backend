import { query } from '../config/database.js';
import Joi from 'joi';

// ==========================================
// Validation Schemas
// ==========================================

const labOrderSchema = Joi.object({
  patient_id: Joi.number().required().messages({
    'number.base': 'Patient ID is required',
  }),
  consultation_id: Joi.number().optional(),
  doctor_id: Joi.number().optional(),
  test_type: Joi.string().required().messages({
    'string.empty': 'Test type is required',
  }),
  test_code: Joi.string().optional(),
  test_name: Joi.string().required().messages({
    'string.empty': 'Test name is required',
  }),
  specimen_type: Joi.string().optional(),
  priority: Joi.string().valid('Routine', 'Urgent', 'Stat').optional(),
  instructions: Joi.string().optional(),
  ordered_date: Joi.date().optional(),
  expected_date: Joi.date().optional(),
  status: Joi.string().valid('Ordered', 'In Progress', 'Completed', 'Cancelled', 'Pending').optional(),
  notes: Joi.string().optional(),
});

const labResultSchema = Joi.object({
  lab_order_id: Joi.number().required().messages({
    'number.base': 'Lab order ID is required',
  }),
  result_value: Joi.string().required().messages({
    'string.empty': 'Result value is required',
  }),
  unit: Joi.string().optional(),
  reference_range: Joi.string().optional(),
  result_status: Joi.string().valid('Normal', 'Abnormal', 'Critical', 'Pending').optional(),
  interpretation: Joi.string().optional(),
  test_date: Joi.date().optional(),
  completion_date: Joi.date().optional(),
  performed_by: Joi.string().optional(),
  notes: Joi.string().optional(),
});

// ==========================================
// Get All Lab Orders with Pagination
// ==========================================
export const getAllLabOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('🧪 Getting lab orders...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) {
      whereClause += ' AND lo.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      whereClause += ' AND lo.status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM lab_orders ${whereClause}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    // Get paginated results
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

    const orders = ordersResult.rows || [];

    console.log(`✅ Found ${orders.length} lab orders`);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting lab orders:', error);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
};

// ==========================================
// Get Single Lab Order with Results
// ==========================================
export const getLabOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🧪 Getting lab order: ${id}`);

    const orderResult = await query(
      `SELECT lo.*, p.first_name, p.last_name, p.phone
       FROM lab_orders lo
       JOIN patients p ON lo.patient_id = p.patient_id
       WHERE lo.lab_order_id = ?`,
      [id]
    );

    if (!orderResult.rows || orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    // Get results for this order
    const resultsResult = await query(
      `SELECT * FROM lab_results WHERE lab_order_id = ? ORDER BY test_date DESC`,
      [id]
    );

    console.log('✅ Lab order found');

    res.json({
      order: orderResult.rows[0],
      results: resultsResult.rows || [],
    });
  } catch (error) {
    console.error('❌ Error getting lab order:', error);
    res.status(500).json({ error: 'Failed to fetch lab order' });
  }
};

// ==========================================
// Get Patient Lab Orders
// ==========================================
export const getPatientLabOrders = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    console.log(`🧪 Getting lab orders for patient: ${patientId}`);

    const result = await query(
      `SELECT lo.*, 
              (SELECT COUNT(*) FROM lab_results WHERE lab_order_id = lo.lab_order_id) as result_count
       FROM lab_orders lo
       WHERE lo.patient_id = ?
       ORDER BY lo.ordered_date DESC
       LIMIT ?`,
      [patientId, limit]
    );

    const orders = result.rows || [];

    console.log(`✅ Found ${orders.length} lab orders`);

    res.json({ orders });
  } catch (error) {
    console.error('❌ Error getting patient lab orders:', error);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
};

// ==========================================
// Create Lab Order
// ==========================================
export const createLabOrder = async (req, res) => {
  try {
    const { error, value } = labOrderSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating lab order...');

    const {
      patient_id,
      consultation_id,
      doctor_id,
      test_type,
      test_code,
      test_name,
      specimen_type,
      priority,
      instructions,
      ordered_date,
      expected_date,
      status,
      notes,
    } = value;

    const result = await query(
      `INSERT INTO lab_orders (
        patient_id, consultation_id, doctor_id, test_type, test_code,
        test_name, specimen_type, priority, instructions,
        ordered_date, expected_date, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        consultation_id || null,
        doctor_id || null,
        test_type,
        test_code || null,
        test_name,
        specimen_type || null,
        priority || 'Routine',
        instructions || null,
        ordered_date || new Date().toISOString().split('T')[0],
        expected_date || null,
        status || 'Ordered',
        notes || null,
        req.user.user_id,
      ]
    );

    console.log(`✅ Lab order created: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Lab order created successfully',
      lab_order_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating lab order:', error);
    res.status(500).json({ error: 'Failed to create lab order' });
  }
};

// ==========================================
// Update Lab Order
// ==========================================
export const updateLabOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = labOrderSchema.validate(req.body);

    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✏️ Updating lab order: ${id}`);

    const existing = await query(
      'SELECT lab_order_id FROM lab_orders WHERE lab_order_id = ?',
      [id]
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const {
      patient_id,
      consultation_id,
      doctor_id,
      test_type,
      test_code,
      test_name,
      specimen_type,
      priority,
      instructions,
      ordered_date,
      expected_date,
      status,
      notes,
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
        consultation_id || null,
        doctor_id || null,
        test_type,
        test_code || null,
        test_name,
        specimen_type || null,
        priority || 'Routine',
        instructions || null,
        ordered_date || new Date().toISOString().split('T')[0],
        expected_date || null,
        status || 'Ordered',
        notes || null,
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

// ==========================================
// Delete Lab Order
// ==========================================
export const deleteLabOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting lab order: ${id}`);

    const result = await query(
      `DELETE FROM lab_orders WHERE lab_order_id = ?`,
      [id]
    );

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

// ==========================================
// Add Lab Result
// ==========================================
export const addLabResult = async (req, res) => {
  try {
    const { error, value } = labResultSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Adding lab result...');

    const {
      lab_order_id,
      result_value,
      unit,
      reference_range,
      result_status,
      interpretation,
      test_date,
      completion_date,
      performed_by,
      notes,
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
        unit || null,
        reference_range || null,
        result_status || 'Pending',
        interpretation || null,
        test_date || new Date().toISOString().split('T')[0],
        completion_date || null,
        performed_by || null,
        notes || null,
        req.user.user_id,
      ]
    );

    // Update order status to Completed if all results added
    await query(
      `UPDATE lab_orders SET status = 'Completed' WHERE lab_order_id = ?`,
      [lab_order_id]
    );

    console.log(`✅ Lab result added: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Lab result added successfully',
      result_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error adding lab result:', error);
    res.status(500).json({ error: 'Failed to add lab result' });
  }
};

// ==========================================
// Get Lab Statistics
// ==========================================
export const getLabStats = async (req, res) => {
  try {
    console.log('📊 Getting lab statistics');

    const stats = {};

    // Total orders
    const totalResult = await query('SELECT COUNT(*) as total FROM lab_orders');
    stats.total_orders = totalResult.rows[0]?.total || 0;

    // By status
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM lab_orders
      GROUP BY status
    `);

    stats.by_status = {};
    statusResult.rows?.forEach(row => {
      stats.by_status[row.status] = row.count;
    });

    // Total results
    const resultsResult = await query('SELECT COUNT(*) as total FROM lab_results');
    stats.total_results = resultsResult.rows[0]?.total || 0;

    // Pending results
    const pendingResult = await query(
      `SELECT COUNT(*) as total FROM lab_results WHERE result_status = 'Pending'`
    );
    stats.pending_results = pendingResult.rows[0]?.total || 0;

    console.log('✅ Statistics retrieved:', stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};