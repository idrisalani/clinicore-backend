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

const n     = (v) => (v === '' || v === undefined) ? null : v;
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
  patient_id:              Joi.number().integer().required(),
  consultation_id:         Joi.number().integer().optional().allow(null, ''),
  invoice_date:            Joi.string().optional(),
  due_date:                Joi.string().optional().allow(null, ''),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity:    Joi.number().min(1).default(1),
    unit_price:  Joi.number().min(0).required(),
    category:    Joi.string().optional().allow(null, ''),
  })).min(1).required(),
  discount_amount:         Joi.number().min(0).optional().default(0),
  notes:                   Joi.string().optional().allow(null, ''),
  insurance_provider:      Joi.string().optional().allow(null, ''),
  insurance_policy_number: Joi.string().optional().allow(null, ''),
});

const paymentSchema = Joi.object({
  invoice_id:       Joi.number().integer().required(),
  patient_id:       Joi.number().integer().required(),
  amount_paid:      Joi.number().min(0.01).required(),
  payment_method:   Joi.string().valid('Cash','Card','Transfer','Insurance','Other').required(),
  payment_date:     Joi.string().optional(),
  reference_number: Joi.string().optional().allow(null, ''),
  notes:            Joi.string().optional().allow(null, ''),
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
      `SELECT i.*, p.first_name, p.last_name, p.phone
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
    const payments = await getAll(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [req.params.id]
    );
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

    const countRes      = await getOne('SELECT COUNT(*) AS n FROM invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String((countRes?.n || 0) + 1).padStart(4, '0')}`;

    const subtotal    = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const totalAmount = Math.max(0, subtotal - (discount_amount || 0));

    const result = await query(
      `INSERT INTO invoices (
        patient_id, consultation_id, invoice_number, invoice_date, due_date,
        subtotal, discount_amount, total_amount, amount_paid, amount_due, status,
        notes, insurance_provider, insurance_policy_number,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Issued', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        patient_id, n(consultation_id), invoiceNumber,
        invoice_date || today(), n(due_date),
        subtotal, discount_amount || 0, totalAmount, totalAmount,
        n(notes), n(insurance_provider), n(insurance_policy_number),
        req.user.user_id,
      ]
    );

    for (const item of items) {
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          result.lastID, item.description, item.quantity || 1,
          item.unit_price, (item.quantity || 1) * item.unit_price, n(item.category),
        ]
      );
    }

    console.log(`✅ Invoice created: ${invoiceNumber}`);
    res.status(201).json({
      message:        'Invoice created successfully',
      invoice_id:     result.lastID,
      invoice_number: invoiceNumber,
      total_amount:   totalAmount,
    });

    triggerInvoiceNotification(result.lastID, patient_id)
      .catch(e => console.warn('Invoice notification failed (non-critical):', e.message));
  } catch (err) {
    console.error('createInvoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// ── PUT /billing/invoices/:id ─────────────────────────────────────────────────
export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT invoice_id FROM invoices WHERE invoice_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const {
      status, notes, due_date, discount_amount,
      insurance_provider, insurance_policy_number,
    } = req.body;

    await query(
      `UPDATE invoices SET
        status                  = COALESCE(?, status),
        notes                   = COALESCE(?, notes),
        due_date                = COALESCE(?, due_date),
        discount_amount         = COALESCE(?, discount_amount),
        insurance_provider      = COALESCE(?, insurance_provider),
        insurance_policy_number = COALESCE(?, insurance_policy_number),
        updated_at              = CURRENT_TIMESTAMP
       WHERE invoice_id = ?`,
      [
        n(status), n(notes), n(due_date), n(discount_amount),
        n(insurance_provider), n(insurance_policy_number), id,
      ]
    );
    res.json({ message: 'Invoice updated', invoice_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /billing/invoices/:id ──────────────────────────────────────────────
export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await getOne('SELECT status FROM invoices WHERE invoice_id = ?', [id]);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Paid') return res.status(400).json({ error: 'Cannot delete a paid invoice' });
    await query('DELETE FROM invoices WHERE invoice_id = ?', [id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /billing/payments ────────────────────────────────────────────────────
export const recordPayment = async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      invoice_id, patient_id, amount_paid, payment_method,
      payment_date, reference_number, notes,
    } = value;

    const invoice = await getOne('SELECT * FROM invoices WHERE invoice_id = ?', [invoice_id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const newAmountPaid = (invoice.amount_paid || 0) + amount_paid;
    const newAmountDue  = Math.max(0, invoice.total_amount - newAmountPaid);
    const newStatus     = newAmountDue <= 0 ? 'Paid'
                        : newAmountPaid > 0 ? 'Partially Paid'
                        : 'Issued';

    const countRes      = await getOne('SELECT COUNT(*) AS n FROM payments');
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

    triggerPaymentConfirmation(invoice_id, patient_id, amount_paid, newAmountDue)
      .catch(e => console.warn('Payment notification failed (non-critical):', e.message));
  } catch (err) {
    console.error('recordPayment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

// ── GET /billing/payments ─────────────────────────────────────────────────────
// Exported as BOTH names — routes use 'getPayments', other code may use 'getAllPayments'
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, patient_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (patient_id) { where.push('pay.patient_id = ?');    params.push(patient_id); }
    if (start_date) { where.push('pay.payment_date >= ?'); params.push(start_date); }
    if (end_date)   { where.push('pay.payment_date <= ?'); params.push(end_date);   }
    const w = `WHERE ${where.join(' AND ')}`;

    const total = await getOne(`SELECT COUNT(*) AS n FROM payments pay ${w}`, params);
    const rows  = await getAll(
      `SELECT pay.*, p.first_name, p.last_name, i.invoice_number
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
// Alias — billingRoutes.js imports this name
export const getPayments = getAllPayments;

// ── GET /billing/stats ────────────────────────────────────────────────────────
export const getBillingStats = async (req, res) => {
  try {
    const [inv, pay] = await Promise.all([
      getOne(`
        SELECT
          COUNT(*)                                                      AS total_invoices,
          SUM(total_amount)                                             AS total_billed,
          SUM(amount_paid)                                              AS total_collected,
          SUM(amount_due)                                               AS total_outstanding,
          SUM(CASE WHEN status = 'Paid'          THEN 1 ELSE 0 END)    AS paid_count,
          SUM(CASE WHEN status = 'Partially Paid' THEN 1 ELSE 0 END)   AS partial_count,
          SUM(CASE WHEN status = 'Overdue'        THEN 1 ELSE 0 END)   AS overdue_count
        FROM invoices`
      ),
      getOne(`
        SELECT COUNT(*) AS total_payments, SUM(amount_paid) AS total_received
        FROM payments WHERE payment_date >= date('now', '-30 days')`
      ),
    ]);
    res.json({ invoices: inv || {}, payments: pay || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/services ─────────────────────────────────────────────────────
export const getAllServices = async (req, res) => {
  try {
    const { is_active = 1 } = req.query;
    const rows = await getAll(
      'SELECT * FROM services WHERE is_active = ? ORDER BY service_name ASC', [is_active]
    );
    res.json({ services: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /billing/services ────────────────────────────────────────────────────
export const createService = async (req, res) => {
  try {
    const { service_name, service_code, category, description, base_price, is_active } = req.body;
    if (!service_name) return res.status(400).json({ error: 'service_name is required' });
    if (!base_price)   return res.status(400).json({ error: 'base_price is required' });

    const result = await query(
      `INSERT INTO services (service_name, service_code, category, description, base_price, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        service_name, n(service_code), n(category), n(description),
        parseFloat(base_price), is_active !== undefined ? is_active : 1,
      ]
    );
    res.status(201).json({ message: 'Service created', service_id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/reports/revenue ──────────────────────────────────────────────
export const getRevenueReport = async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    let groupBy, label;
    if (period === 'daily') {
      groupBy = "strftime('%Y-%m-%d', payment_date)";
      label   = "strftime('%d %b', payment_date)";
    } else {
      groupBy = "strftime('%Y-%m', payment_date)";
      label   = "strftime('%b %Y', payment_date)";
    }
    const rows = await getAll(`
      SELECT ${groupBy} AS period, ${label} AS label,
             SUM(amount_paid) AS revenue, COUNT(*) AS payment_count
      FROM payments WHERE strftime('%Y', payment_date) = ?
      GROUP BY ${groupBy} ORDER BY period ASC
    `, [String(year)]);

    const summary = await getOne(`
      SELECT SUM(amount_paid) AS total_revenue, COUNT(*) AS total_payments,
             AVG(amount_paid) AS avg_payment
      FROM payments WHERE strftime('%Y', payment_date) = ?
    `, [String(year)]);

    res.json({ revenue: rows, summary, period, year });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/reports/by-service ──────────────────────────────────────────
export const getRevenueByService = async (req, res) => {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const prevMonth = new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0, 7);

    const [byMethod, byStatus, topPatients, monthComparison] = await Promise.all([
      getAll(`SELECT payment_method, COUNT(*) AS count, SUM(amount_paid) AS total
              FROM payments GROUP BY payment_method ORDER BY total DESC`),
      getAll(`SELECT status, COUNT(*) AS count, SUM(total_amount) AS total_amount,
                     SUM(amount_paid) AS collected, SUM(amount_due) AS outstanding
              FROM invoices GROUP BY status ORDER BY total_amount DESC`),
      getAll(`SELECT p.first_name || ' ' || p.last_name AS patient_name, p.phone,
                     COUNT(DISTINCT i.invoice_id) AS invoices, SUM(pay.amount_paid) AS total_paid
              FROM payments pay
              JOIN invoices i ON pay.invoice_id = i.invoice_id
              JOIN patients p ON i.patient_id = p.patient_id
              GROUP BY p.patient_id ORDER BY total_paid DESC LIMIT 10`),
      getAll(`SELECT strftime('%Y-%m', payment_date) AS month,
                     SUM(amount_paid) AS revenue, COUNT(*) AS payments
              FROM payments WHERE strftime('%Y-%m', payment_date) IN (?, ?)
              GROUP BY month`, [thisMonth, prevMonth]),
    ]);

    res.json({ byMethod, byStatus, topPatients, monthComparison });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/reports/outstanding ─────────────────────────────────────────
export const getOutstandingReport = async (req, res) => {
  try {
    const outstanding = await getAll(`
      SELECT i.*, p.first_name, p.last_name, p.phone,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue
      FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
      WHERE i.status NOT IN ('Paid','Cancelled','Draft') AND i.amount_due > 0
      ORDER BY i.due_date ASC
    `);
    const aging = await getOne(`
      SELECT
        SUM(CASE WHEN julianday('now')-julianday(due_date) <= 30             THEN amount_due ELSE 0 END) AS current_30,
        SUM(CASE WHEN julianday('now')-julianday(due_date) BETWEEN 31 AND 60 THEN amount_due ELSE 0 END) AS days_31_60,
        SUM(CASE WHEN julianday('now')-julianday(due_date) BETWEEN 61 AND 90 THEN amount_due ELSE 0 END) AS days_61_90,
        SUM(CASE WHEN julianday('now')-julianday(due_date) > 90              THEN amount_due ELSE 0 END) AS over_90,
        SUM(amount_due) AS total_outstanding, COUNT(*) AS invoice_count
      FROM invoices WHERE status NOT IN ('Paid','Cancelled','Draft') AND amount_due > 0
    `);
    res.json({ outstanding, aging, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /billing/reports/summary ──────────────────────────────────────────────
export const getFinancialSummary = async (req, res) => {
  try {
    const startOfMonth = today().slice(0, 7) + '-01';
    const startOfYear  = today().slice(0, 4) + '-01-01';

    const [daily, monthly, yearly, outstanding, byMethod] = await Promise.all([
      getOne('SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date = ?', [today()]),
      getOne('SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date >= ?', [startOfMonth]),
      getOne('SELECT SUM(amount_paid) AS total, COUNT(*) AS count FROM payments WHERE payment_date >= ?', [startOfYear]),
      getOne("SELECT SUM(amount_due) AS total, COUNT(*) AS count FROM invoices WHERE status NOT IN ('Paid','Cancelled','Draft') AND amount_due > 0"),
      getAll('SELECT payment_method, SUM(amount_paid) AS total FROM payments WHERE payment_date >= ? GROUP BY payment_method ORDER BY total DESC', [startOfMonth]),
    ]);

    res.json({
      today:       { revenue: daily?.total    || 0, payments: daily?.count    || 0 },
      this_month:  { revenue: monthly?.total  || 0, payments: monthly?.count  || 0 },
      this_year:   { revenue: yearly?.total   || 0, payments: yearly?.count   || 0 },
      outstanding: { amount:  outstanding?.total || 0, invoices: outstanding?.count || 0 },
      payment_methods: byMethod,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};