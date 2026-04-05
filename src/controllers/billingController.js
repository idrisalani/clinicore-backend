// ============================================
// Billing Controller — COMPLETE UPDATED FILE
// File: backend/src/controllers/billingController.js
// ============================================

import { query } from '../config/database.js';
import Joi from 'joi';
import { sendPaymentConfirmation, logNotification } from '../services/notificationService.js';


// ── Helpers ───────────────────────────────────────────────────────────────────
const getOne = async (sql, params = []) => (await query(sql, params)).rows?.[0] || null;
const getAll = async (sql, params = []) => (await query(sql, params)).rows || [];

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
  status: Joi.string().valid('Draft','Issued','Sent','Partially Paid','Paid','Overdue','Cancelled').optional(),
  notes: Joi.string().optional(),
  payment_terms: Joi.string().optional(),
});

const paymentSchema = Joi.object({
  invoice_id: Joi.number().required(),
  patient_id: Joi.number().required(),
  payment_date: Joi.date().required(),
  amount_paid: Joi.number().required(),
  payment_method: Joi.string().valid('Cash','Bank Transfer','Card','Cheque','Mobile Money','Other').optional(),
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
// INVOICES
// ==========================================

export const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '', start_date = '', end_date = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) { whereClause += ' AND i.patient_id = ?'; params.push(patient_id); }
    if (status)     { whereClause += ' AND i.status = ?';     params.push(status);     }
    if (start_date) { whereClause += ' AND i.invoice_date >= ?'; params.push(start_date); }
    if (end_date)   { whereClause += ' AND i.invoice_date <= ?'; params.push(end_date);   }

    const countResult = await query(`SELECT COUNT(*) as total FROM invoices i ${whereClause}`, params);
    const total = countResult.rows[0]?.total || 0;

    const invoicesResult = await query(
      `SELECT i.*, p.first_name, p.last_name
       FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
       ${whereClause} ORDER BY i.invoice_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      invoices: invoicesResult.rows || [],
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const invoiceResult = await query(
      `SELECT i.*, p.first_name, p.last_name, p.phone, p.email
       FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
       WHERE i.invoice_id = ?`, [id]
    );
    if (!invoiceResult.rows?.length) return res.status(404).json({ error: 'Invoice not found' });

    const lineItems = await query('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY line_item_id', [id]);
    const payments  = await query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [id]);

    res.json({ invoice: invoiceResult.rows[0], lineItems: lineItems.rows || [], payments: payments.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

export const createInvoice = async (req, res) => {
  try {
    const { patient_id, recipient_name, recipient_email, recipient_phone,
      invoice_date, due_date, status, subtotal, tax_percent,
      discount_percent, payment_terms, notes } = req.body;

    const schema = Joi.object({
      patient_id: Joi.number().required(),
      recipient_name: Joi.string().required(),
      recipient_email: Joi.string().email().required(),
      recipient_phone: Joi.string().optional(),
      invoice_date: Joi.date().required(),
      due_date: Joi.date().required(),
      status: Joi.string().default('draft'),
      subtotal: Joi.number().min(0).required(),
      tax_percent: Joi.number().min(0).optional(),
      discount_percent: Joi.number().min(0).optional(),
      payment_terms: Joi.string().optional(),
      notes: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const tax_amount      = (subtotal * (tax_percent || 0)) / 100;
    const discount_amount = (subtotal * (discount_percent || 0)) / 100;
    const total_amount    = subtotal + tax_amount - discount_amount;

    const result = await query(
      `INSERT INTO invoices (
        patient_id, recipient_name, recipient_email, recipient_phone,
        invoice_date, due_date, status, subtotal, tax_percent, tax_amount,
        discount_percent, discount_amount, total_amount, amount_due,
        payment_terms, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, recipient_name, recipient_email, recipient_phone || null,
       invoice_date, due_date, status || 'Draft', subtotal,
       tax_percent || 0, tax_amount, discount_percent || 0, discount_amount,
       total_amount, total_amount, payment_terms || null, notes || null, req.user.user_id]
    );

    res.status(201).json({ message: 'Invoice created successfully', invoice_id: result.lastID, total_amount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { patient_id, consultation_id, doctor_id, invoice_date, due_date, subtotal,
      tax_percentage, tax_amount, discount_percentage, discount_amount,
      total_amount, status, notes, payment_terms } = value;

    await query(
      `UPDATE invoices SET patient_id=?, consultation_id=?, doctor_id=?,
        invoice_date=?, due_date=?, subtotal=?, tax_percentage=?, tax_amount=?,
        discount_percentage=?, discount_amount=?, total_amount=?, status=?,
        amount_due=?, notes=?, payment_terms=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
       WHERE invoice_id=?`,
      [patient_id, consultation_id||null, doctor_id||null, invoice_date, due_date||null,
       subtotal, tax_percentage||0, tax_amount||0, discount_percentage||0,
       discount_amount||0, total_amount, status||'Draft', total_amount,
       notes||null, payment_terms||null, req.user.user_id, id]
    );

    res.json({ message: 'Invoice updated successfully', invoice_id: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM invoices WHERE invoice_id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

// ==========================================
// PAYMENTS
// ==========================================

export const recordPayment = async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
 
    const { invoice_id, patient_id, payment_date, amount_paid,
            payment_method, reference_number, notes } = value;
 
    const invoiceResult = await query(
      'SELECT invoice_id, total_amount, amount_paid FROM invoices WHERE invoice_id = ?',
      [invoice_id]
    );
    if (!invoiceResult.rows?.length) return res.status(404).json({ error: 'Invoice not found' });
 
    const invoice      = invoiceResult.rows[0];
    const newTotalPaid = (invoice.amount_paid || 0) + amount_paid;
    const newAmountDue = Math.max(0, invoice.total_amount - newTotalPaid);
    const newStatus    = newTotalPaid >= invoice.total_amount ? 'Paid' : 'Partially Paid';
 
    const paymentResult = await query(
      `INSERT INTO payments
        (invoice_id, patient_id, payment_date, amount_paid,
         payment_method, reference_number, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_id, patient_id, payment_date, amount_paid,
       payment_method || 'Cash', reference_number || null,
       notes || null, req.user.user_id]
    );
 
    await query(
      'UPDATE invoices SET amount_paid=?, amount_due=?, status=? WHERE invoice_id=?',
      [newTotalPaid, newAmountDue, newStatus, invoice_id]
    );
 
    const receiptNumber = `RCP-${Date.now()}`;
    await query(
      'INSERT INTO receipts (payment_id, receipt_number, receipt_date, amount, issued_by) VALUES (?, ?, ?, ?, ?)',
      [paymentResult.lastID, receiptNumber,
       new Date().toISOString().split('T')[0], amount_paid, req.user.user_id]
    );
 
    // ── Fire-and-forget: notify patient of payment ────────────────────────────
    ;(async () => {
      try {
        const patResult = await query(
          `SELECT p.first_name, p.last_name, p.phone, p.email,
                  i.invoice_number
           FROM patients p
           JOIN invoices i ON i.invoice_id = ?
           WHERE p.patient_id = ?`,
          [invoice_id, patient_id]
        );
        const pat = patResult.rows?.[0];
        if (!pat) return;
 
        await sendPaymentConfirmation({
          patientName:      `${pat.first_name} ${pat.last_name}`,
          patientPhone:     pat.phone,
          patientEmail:     pat.email,
          invoiceNumber:    pat.invoice_number || `INV-${invoice_id}`,
          amountPaid:       amount_paid,
          remainingBalance: newAmountDue,
        });
 
        await logNotification(query, {
          patient_id,
          type:        'payment',
          channel:     pat.phone && pat.email ? 'both' : pat.phone ? 'sms' : 'email',
          recipient:   pat.phone || pat.email,
          body:        `Payment of ₦${Number(amount_paid).toLocaleString('en-NG')} confirmed`,
          status:      'sent',
          reference_id:String(invoice_id),
        });
      } catch (notifErr) {
        console.warn('Payment notification failed (non-critical):', notifErr.message);
      }
    })();
 
    res.status(201).json({
      message:        'Payment recorded successfully',
      payment_id:     paymentResult.lastID,
      receipt_number: receiptNumber,
      amount_paid,
      invoice_status: newStatus,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

export const getPayments = async (req, res) => {
  try {
    const { invoice_id = '', patient_id = '' } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (invoice_id) { whereClause += ' AND p.invoice_id = ?'; params.push(invoice_id); }
    if (patient_id) { whereClause += ' AND p.patient_id = ?'; params.push(patient_id); }

    const result = await query(
      `SELECT p.*, pat.first_name, pat.last_name
       FROM payments p JOIN patients pat ON p.patient_id = pat.patient_id
       ${whereClause} ORDER BY p.payment_date DESC`, params
    );
    res.json({ payments: result.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// ==========================================
// SERVICES
// ==========================================

export const getAllServices = async (req, res) => {
  try {
    const { is_active = 1 } = req.query;
    const result = await query('SELECT * FROM services WHERE is_active = ? ORDER BY service_name', [is_active]);
    res.json({ services: result.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

export const createService = async (req, res) => {
  try {
    const { error, value } = serviceSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { service_name, service_code, category, description, base_price, is_active } = value;
    const result = await query(
      'INSERT INTO services (service_name, service_code, category, description, base_price, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [service_name, service_code||null, category||null, description||null, base_price, is_active !== undefined ? is_active : 1]
    );
    res.status(201).json({ message: 'Service created successfully', service_id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service' });
  }
};

// ==========================================
// BILLING STATISTICS (existing)
// ==========================================

export const getBillingStats = async (req, res) => {
  try {
    const { start_date = '', end_date = '' } = req.query;
    let dateFilter = '';
    let params = [];
    if (start_date) { dateFilter += ' AND invoice_date >= ?'; params.push(start_date); }
    if (end_date)   { dateFilter += ' AND invoice_date <= ?'; params.push(end_date);   }

    const [revenue, receivables, totalInvoices, byStatus] = await Promise.all([
      query(`SELECT SUM(amount_paid) as total FROM payments WHERE 1=1 ${dateFilter}`, params),
      query(`SELECT SUM(amount_due) as total FROM invoices WHERE status != 'Paid' AND 1=1 ${dateFilter}`, params),
      query(`SELECT COUNT(*) as total FROM invoices WHERE 1=1 ${dateFilter}`, params),
      query(`SELECT status, COUNT(*) as count FROM invoices WHERE 1=1 ${dateFilter} GROUP BY status`, params),
    ]);

    const stats = {
      total_revenue:           revenue.rows[0]?.total          || 0,
      outstanding_receivables: receivables.rows[0]?.total      || 0,
      total_invoices:          totalInvoices.rows[0]?.total    || 0,
      by_status: {},
    };
    byStatus.rows?.forEach(r => { stats.by_status[r.status] = r.count; });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// ==========================================
// FINANCIAL REPORTS (NEW)
// ==========================================

export const getRevenueReport = async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear(), start_date = '', end_date = '' } = req.query;

    let groupBy, dateLabel;
    if (period === 'daily') {
      groupBy   = "strftime('%Y-%m-%d', payment_date)";
      dateLabel = "strftime('%d %b', payment_date)";
    } else if (period === 'weekly') {
      groupBy   = "strftime('%Y-W%W', payment_date)";
      dateLabel = "strftime('%Y-W%W', payment_date)";
    } else {
      groupBy   = "strftime('%Y-%m', payment_date)";
      dateLabel = "strftime('%b %Y', payment_date)";
    }

    let where  = ['1=1'];
    let params = [];
    if (start_date) { where.push('payment_date >= ?'); params.push(start_date); }
    if (end_date)   { where.push('payment_date <= ?'); params.push(end_date);   }
    if (!start_date && !end_date) {
      where.push("strftime('%Y', payment_date) = ?");
      params.push(String(year));
    }

    const revenueRows = await getAll(`
      SELECT
        ${groupBy}       AS period,
        ${dateLabel}     AS label,
        SUM(amount_paid) AS revenue,
        COUNT(*)         AS payment_count,
        AVG(amount_paid) AS avg_payment
      FROM payments
      WHERE ${where.join(' AND ')}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);

    const summary = await getOne(`
      SELECT
        SUM(amount_paid) AS total_revenue,
        COUNT(*)         AS total_payments,
        AVG(amount_paid) AS avg_payment,
        MAX(amount_paid) AS largest_payment
      FROM payments WHERE ${where.join(' AND ')}
    `, params);

    res.json({ revenue: revenueRows, summary, period, year });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRevenueByService = async (req, res) => {
  try {
    const { start_date = '', end_date = '' } = req.query;
    let params = [];
    let dateWhere = '1=1';
    if (start_date) { dateWhere += ' AND payment_date >= ?'; params.push(start_date); }
    if (end_date)   { dateWhere += ' AND payment_date <= ?'; params.push(end_date);   }

    const [byMethod, byStatus, topPatients] = await Promise.all([
      getAll(`
        SELECT payment_method,
          COUNT(*)         AS count,
          SUM(amount_paid) AS total,
          ROUND(SUM(amount_paid) * 100.0 / (SELECT SUM(amount_paid) FROM payments), 1) AS percentage
        FROM payments WHERE ${dateWhere}
        GROUP BY payment_method ORDER BY total DESC
      `, params),
      getAll(`
        SELECT status, COUNT(*) AS count,
          SUM(total_amount) AS total_amount,
          SUM(amount_paid)  AS amount_collected,
          SUM(amount_due)   AS amount_outstanding
        FROM invoices WHERE 1=1
          ${start_date ? ' AND invoice_date >= ?' : ''}
          ${end_date   ? ' AND invoice_date <= ?' : ''}
        GROUP BY status ORDER BY total_amount DESC
      `, params),
      getAll(`
        SELECT p.first_name || ' ' || p.last_name AS patient_name, p.phone,
          COUNT(DISTINCT i.invoice_id) AS invoice_count,
          SUM(pay.amount_paid)         AS total_paid
        FROM payments pay
        JOIN invoices i ON pay.invoice_id = i.invoice_id
        JOIN patients p ON i.patient_id   = p.patient_id
        WHERE ${dateWhere}
        GROUP BY p.patient_id ORDER BY total_paid DESC LIMIT 10
      `, params),
    ]);

    const currentMonth  = new Date().toISOString().slice(0, 7);
    const previousMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const monthComparison = await getAll(`
      SELECT strftime('%Y-%m', payment_date) AS month,
        SUM(amount_paid) AS revenue, COUNT(*) AS payments
      FROM payments WHERE strftime('%Y-%m', payment_date) IN (?, ?)
      GROUP BY month
    `, [currentMonth, previousMonth]);

    res.json({ byMethod, byStatus, topPatients, monthComparison });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOutstandingReport = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const outstanding = await getAll(`
      SELECT i.*, p.first_name, p.last_name, p.phone, p.email,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue,
        CASE
          WHEN i.due_date < ? AND i.status NOT IN ('Paid','Cancelled') THEN 'Overdue'
          WHEN i.status = 'Partially Paid' THEN 'Partial'
          WHEN i.status = 'Issued'         THEN 'Pending'
          ELSE i.status
        END AS aging_status
      FROM invoices i
      JOIN patients p ON i.patient_id = p.patient_id
      WHERE i.status NOT IN ('Paid','Cancelled','Draft') AND i.amount_due > 0
      ORDER BY i.due_date ASC
    `, [today]);

    const aging = await getOne(`
      SELECT
        SUM(CASE WHEN julianday('now') - julianday(due_date) <= 30  THEN amount_due ELSE 0 END) AS current_30,
        SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 31 AND 60 THEN amount_due ELSE 0 END) AS days_31_60,
        SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 61 AND 90 THEN amount_due ELSE 0 END) AS days_61_90,
        SUM(CASE WHEN julianday('now') - julianday(due_date) > 90   THEN amount_due ELSE 0 END) AS over_90,
        SUM(amount_due) AS total_outstanding,
        COUNT(*)        AS invoice_count
      FROM invoices
      WHERE status NOT IN ('Paid','Cancelled','Draft') AND amount_due > 0
    `, []);

    res.json({ outstanding, aging, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFinancialSummary = async (req, res) => {
  try {
    const today        = new Date().toISOString().split('T')[0];
    const startOfMonth = today.slice(0, 7) + '-01';
    const startOfYear  = today.slice(0, 4) + '-01-01';

    const [daily, monthly, yearly, outstanding, paymentMethods] = await Promise.all([
      getOne(`SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date = ?`, [today]),
      getOne(`SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date >= ?`, [startOfMonth]),
      getOne(`SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date >= ?`, [startOfYear]),
      getOne(`SELECT SUM(amount_due) AS total, COUNT(*) AS count FROM invoices WHERE status NOT IN ('Paid','Cancelled','Draft') AND amount_due > 0`, []),
      getAll(`SELECT payment_method, SUM(amount_paid) AS total FROM payments WHERE payment_date >= ? GROUP BY payment_method ORDER BY total DESC`, [startOfMonth]),
    ]);

    res.json({
      today:           { revenue: daily?.total       || 0, payments: daily?.count       || 0 },
      this_month:      { revenue: monthly?.total     || 0, payments: monthly?.count     || 0 },
      this_year:       { revenue: yearly?.total      || 0, payments: yearly?.count      || 0 },
      outstanding:     { amount:  outstanding?.total || 0, invoices: outstanding?.count || 0 },
      payment_methods: paymentMethods,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};