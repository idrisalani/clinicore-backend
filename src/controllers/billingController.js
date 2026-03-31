import { query } from '../config/database.js';
import Joi from 'joi';

// ==========================================
// Validation Schemas
// ==========================================

const invoiceSchema = Joi.object({
  patient_id: Joi.number().required(),
  consultation_id: Joi.number().optional(),
  doctor_id: Joi.number().optional(),
  invoice_date: Joi.date().required(),
  due_date: Joi.date().optional(),
  subtotal: Joi.number().required(),
  tax_percentage: Joi.number().optional(),
  tax_amount: Joi.number().optional(),
  discount_percentage: Joi.number().optional(),
  discount_amount: Joi.number().optional(),
  total_amount: Joi.number().required(),
  status: Joi.string().valid('Draft', 'Issued', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled').optional(),
  notes: Joi.string().optional(),
  payment_terms: Joi.string().optional(),
});

const paymentSchema = Joi.object({
  invoice_id: Joi.number().required(),
  patient_id: Joi.number().required(),
  payment_date: Joi.date().required(),
  amount_paid: Joi.number().required(),
  payment_method: Joi.string().valid('Cash', 'Bank Transfer', 'Card', 'Cheque', 'Mobile Money', 'Other').optional(),
  reference_number: Joi.string().optional(),
  notes: Joi.string().optional(),
});

const serviceSchema = Joi.object({
  service_name: Joi.string().required(),
  service_code: Joi.string().optional(),
  category: Joi.string().optional(),
  description: Joi.string().optional(),
  base_price: Joi.number().required(),
  is_active: Joi.number().optional(),
});

// ==========================================
// INVOICES ENDPOINTS
// ==========================================

export const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '', start_date = '', end_date = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('💰 Getting invoices...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) {
      whereClause += ' AND i.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (start_date) {
      whereClause += ' AND i.invoice_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND i.invoice_date <= ?';
      params.push(end_date);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM invoices ${whereClause}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    const invoicesResult = await query(
      `SELECT i.*, p.first_name, p.last_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.patient_id
       ${whereClause}
       ORDER BY i.invoice_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const invoices = invoicesResult.rows || [];

    console.log(`✅ Found ${invoices.length} invoices`);

    res.json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💰 Getting invoice: ${id}`);

    const invoiceResult = await query(
      `SELECT i.*, p.first_name, p.last_name, p.phone, p.email
       FROM invoices i
       JOIN patients p ON i.patient_id = p.patient_id
       WHERE i.invoice_id = ?`,
      [id]
    );

    if (!invoiceResult.rows || invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get line items
    const lineItemsResult = await query(
      `SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY line_item_id`,
      [id]
    );

    // Get payments
    const paymentsResult = await query(
      `SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    console.log('✅ Invoice found');

    res.json({
      invoice: invoiceResult.rows[0],
      lineItems: lineItemsResult.rows || [],
      payments: paymentsResult.rows || [],
    });
  } catch (error) {
    console.error('❌ Error getting invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

export const createInvoice = async (req, res) => {
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating invoice...');

    // Get next invoice number
    const settingsResult = await query('SELECT next_invoice_number, invoice_prefix FROM billing_settings LIMIT 1');
    const invoicePrefix = settingsResult.rows[0]?.invoice_prefix || 'INV-';
    const nextNumber = settingsResult.rows[0]?.next_invoice_number || 1001;
    const invoiceNumber = `${invoicePrefix}${nextNumber}`;

    const {
      patient_id,
      consultation_id,
      doctor_id,
      invoice_date,
      due_date,
      subtotal,
      tax_percentage,
      tax_amount,
      discount_percentage,
      discount_amount,
      total_amount,
      status,
      notes,
      payment_terms,
    } = value;

    const result = await query(
      `INSERT INTO invoices (
        patient_id, consultation_id, doctor_id, invoice_number,
        invoice_date, due_date, subtotal, tax_percentage, tax_amount,
        discount_percentage, discount_amount, total_amount, status,
        amount_due, notes, payment_terms, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        consultation_id || null,
        doctor_id || null,
        invoiceNumber,
        invoice_date,
        due_date || null,
        subtotal,
        tax_percentage || 0,
        tax_amount || 0,
        discount_percentage || 0,
        discount_amount || 0,
        total_amount,
        status || 'Draft',
        total_amount,
        notes || null,
        payment_terms || null,
        req.user.user_id,
      ]
    );

    // Update next invoice number
    await query('UPDATE billing_settings SET next_invoice_number = next_invoice_number + 1');

    console.log(`✅ Invoice created: ${invoiceNumber}`);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice_id: result.lastID,
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = invoiceSchema.validate(req.body);

    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✏️ Updating invoice: ${id}`);

    const {
      patient_id,
      consultation_id,
      doctor_id,
      invoice_date,
      due_date,
      subtotal,
      tax_percentage,
      tax_amount,
      discount_percentage,
      discount_amount,
      total_amount,
      status,
      notes,
      payment_terms,
    } = value;

    await query(
      `UPDATE invoices SET
        patient_id = ?, consultation_id = ?, doctor_id = ?,
        invoice_date = ?, due_date = ?, subtotal = ?,
        tax_percentage = ?, tax_amount = ?, discount_percentage = ?,
        discount_amount = ?, total_amount = ?, status = ?,
        amount_due = ?, notes = ?, payment_terms = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = ?`,
      [
        patient_id,
        consultation_id || null,
        doctor_id || null,
        invoice_date,
        due_date || null,
        subtotal,
        tax_percentage || 0,
        tax_amount || 0,
        discount_percentage || 0,
        discount_amount || 0,
        total_amount,
        status || 'Draft',
        total_amount,
        notes || null,
        payment_terms || null,
        req.user.user_id,
        id,
      ]
    );

    console.log(`✅ Invoice updated: ${id}`);

    res.json({ message: 'Invoice updated successfully', invoice_id: id });
  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting invoice: ${id}`);

    const result = await query(
      'DELETE FROM invoices WHERE invoice_id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log(`✅ Invoice deleted: ${id}`);

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

// ==========================================
// PAYMENTS ENDPOINTS
// ==========================================

export const recordPayment = async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Recording payment...');

    const {
      invoice_id,
      patient_id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    } = value;

    // Get invoice details
    const invoiceResult = await query(
      'SELECT invoice_id, total_amount, amount_paid FROM invoices WHERE invoice_id = ?',
      [invoice_id]
    );

    if (!invoiceResult.rows || invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    const previouslyPaid = invoice.amount_paid || 0;
    const newTotalPaid = previouslyPaid + amount_paid;
    const invoiceTotal = invoice.total_amount;

    // Determine new status
    let newStatus = 'Partially Paid';
    if (newTotalPaid >= invoiceTotal) {
      newStatus = 'Paid';
    }

    // Record payment
    const paymentResult = await query(
      `INSERT INTO payments (
        invoice_id, patient_id, payment_date, amount_paid,
        payment_method, reference_number, notes, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_id,
        patient_id,
        payment_date,
        amount_paid,
        payment_method || 'Cash',
        reference_number || null,
        notes || null,
        req.user.user_id,
      ]
    );

    // Update invoice with payment details
    await query(
      `UPDATE invoices SET
        amount_paid = ?, amount_due = ?, status = ?
       WHERE invoice_id = ?`,
      [newTotalPaid, Math.max(0, invoiceTotal - newTotalPaid), newStatus, invoice_id]
    );

    // Generate receipt
    const receiptNumber = `RCP-${Date.now()}`;
    await query(
      `INSERT INTO receipts (payment_id, receipt_number, receipt_date, amount, issued_by)
       VALUES (?, ?, ?, ?, ?)`,
      [paymentResult.lastID, receiptNumber, new Date().toISOString().split('T')[0], amount_paid, req.user.user_id]
    );

    console.log(`✅ Payment recorded: ₦${amount_paid.toLocaleString('en-NG')}`);

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment_id: paymentResult.lastID,
      receipt_number: receiptNumber,
      amount_paid: amount_paid,
      invoice_status: newStatus,
    });
  } catch (error) {
    console.error('❌ Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

export const getPayments = async (req, res) => {
  try {
    const { invoice_id = '', patient_id = '' } = req.query;

    console.log('💰 Getting payments...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (invoice_id) {
      whereClause += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }

    if (patient_id) {
      whereClause += ' AND p.patient_id = ?';
      params.push(patient_id);
    }

    const result = await query(
      `SELECT p.*, pat.first_name, pat.last_name
       FROM payments p
       JOIN patients pat ON p.patient_id = pat.patient_id
       ${whereClause}
       ORDER BY p.payment_date DESC`,
      params
    );

    const payments = result.rows || [];

    console.log(`✅ Found ${payments.length} payments`);

    res.json({ payments });
  } catch (error) {
    console.error('❌ Error getting payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// ==========================================
// SERVICES ENDPOINTS
// ==========================================

export const getAllServices = async (req, res) => {
  try {
    const { is_active = 1 } = req.query;

    console.log('💰 Getting services...');

    const result = await query(
      'SELECT * FROM services WHERE is_active = ? ORDER BY service_name',
      [is_active]
    );

    const services = result.rows || [];

    console.log(`✅ Found ${services.length} services`);

    res.json({ services });
  } catch (error) {
    console.error('❌ Error getting services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

export const createService = async (req, res) => {
  try {
    const { error, value } = serviceSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating service...');

    const {
      service_name,
      service_code,
      category,
      description,
      base_price,
      is_active,
    } = value;

    const result = await query(
      `INSERT INTO services (
        service_name, service_code, category, description,
        base_price, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        service_name,
        service_code || null,
        category || null,
        description || null,
        base_price,
        is_active !== undefined ? is_active : 1,
      ]
    );

    console.log(`✅ Service created: ${service_name}`);

    res.status(201).json({
      message: 'Service created successfully',
      service_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
};

// ==========================================
// BILLING STATISTICS
// ==========================================

export const getBillingStats = async (req, res) => {
  try {
    const { start_date = '', end_date = '' } = req.query;

    console.log('📊 Getting billing statistics');

    let dateFilter = '';
    let params = [];

    if (start_date) {
      dateFilter += ' AND i.invoice_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      dateFilter += ' AND i.invoice_date <= ?';
      params.push(end_date);
    }

    const stats = {};

    // Total revenue
    const revenueResult = await query(
      `SELECT SUM(amount_paid) as total FROM payments WHERE 1=1 ${dateFilter}`,
      params
    );
    stats.total_revenue = revenueResult.rows[0]?.total || 0;

    // Outstanding receivables
    const receivablesResult = await query(
      `SELECT SUM(amount_due) as total FROM invoices WHERE status != 'Paid' AND 1=1 ${dateFilter}`,
      params
    );
    stats.outstanding_receivables = receivablesResult.rows[0]?.total || 0;

    // Total invoices
    const totalInvoicesResult = await query(
      `SELECT COUNT(*) as total FROM invoices WHERE 1=1 ${dateFilter}`,
      params
    );
    stats.total_invoices = totalInvoicesResult.rows[0]?.total || 0;

    // By status
    const statusResult = await query(
      `SELECT status, COUNT(*) as count FROM invoices WHERE 1=1 ${dateFilter} GROUP BY status`,
      params
    );

    stats.by_status = {};
    statusResult.rows?.forEach(row => {
      stats.by_status[row.status] = row.count;
    });

    console.log('✅ Statistics retrieved:', stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};