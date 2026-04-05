// ============================================
// pdfRoutes.js
// File: backend/src/routes/pdfRoutes.js
// Mount: app.use('/api/v1/pdf', pdfRoutes)
// ============================================

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generateInvoicePDF,
  generatePatientSummaryPDF,
  generateLabResultPDF,
  generateReceiptPDF,
} from '../services/pdfService.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);

// ── Helper: send PDF response ─────────────────────────────────────────────────
const sendPDF = (res, buffer, filename) => {
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      buffer.length,
    'Cache-Control':       'no-cache',
  });
  res.end(buffer);
};

// ── GET /pdf/invoice/:id ──────────────────────────────────────────────────────
router.get('/invoice/:id',
  authorize('admin', 'receptionist', 'doctor', 'patient'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const invoiceResult = await query(
        `SELECT i.*, p.first_name, p.last_name, p.phone, p.email
         FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
         WHERE i.invoice_id = ?`, [id]
      );
      if (!invoiceResult.rows?.length) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice  = invoiceResult.rows[0];
      const patient  = {
        first_name: invoice.first_name, last_name: invoice.last_name,
        phone: invoice.phone,           email: invoice.email,
      };

      // Patients can only download their own invoices
      if (req.user.role === 'patient') {
        const patRow = await query(
          'SELECT patient_id FROM patients WHERE user_id = ?', [req.user.user_id]
        );
        if (patRow.rows?.[0]?.patient_id !== invoice.patient_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const lineItems = await query(
        'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY line_item_id', [id]
      );
      const payments = await query(
        'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [id]
      );

      const pdf = await generateInvoicePDF({
        invoice, patient,
        lineItems: lineItems.rows || [],
        payments:  payments.rows  || [],
      });

      const invoiceNum = invoice.invoice_number || `INV-${String(id).padStart(5,'0')}`;
      sendPDF(res, pdf, `${invoiceNum}.pdf`);
    } catch (err) {
      console.error('Invoice PDF error:', err);
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
  }
);

// ── GET /pdf/patient/:id ──────────────────────────────────────────────────────
router.get('/patient/:id',
  authorize('admin', 'doctor', 'nurse', 'patient'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Patients can only download their own summary
      if (req.user.role === 'patient') {
        const patRow = await query(
          'SELECT patient_id FROM patients WHERE user_id = ?', [req.user.user_id]
        );
        if (String(patRow.rows?.[0]?.patient_id) !== String(id)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const patResult = await query(
        'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [id]
      );
      if (!patResult.rows?.length) return res.status(404).json({ error: 'Patient not found' });

      const patient = patResult.rows[0];

      const [appointments, consultations, labOrders, prescriptions] = await Promise.all([
        query(`SELECT a.*, u.full_name AS doctor_name FROM appointments a
               LEFT JOIN users u ON a.doctor_id = u.user_id
               WHERE a.patient_id = ? ORDER BY a.appointment_date DESC LIMIT 20`, [id]),
        query('SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC LIMIT 10', [id]),
        query(`SELECT lo.*, u.full_name AS doctor_name FROM lab_orders lo
               LEFT JOIN users u ON lo.doctor_id = u.user_id
               WHERE lo.patient_id = ? ORDER BY lo.order_date DESC LIMIT 20`, [id]),
        query('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY prescription_date DESC LIMIT 20', [id]),
      ]);

      const pdf = await generatePatientSummaryPDF({
        patient,
        appointments:  appointments.rows  || [],
        consultations: consultations.rows || [],
        labOrders:     labOrders.rows     || [],
        prescriptions: prescriptions.rows || [],
      });

      sendPDF(res, pdf, `Patient-${String(id).padStart(5,'0')}-Summary.pdf`);
    } catch (err) {
      console.error('Patient summary PDF error:', err);
      res.status(500).json({ error: 'Failed to generate patient summary PDF' });
    }
  }
);

// ── GET /pdf/lab/:id ──────────────────────────────────────────────────────────
router.get('/lab/:id',
  authorize('admin', 'doctor', 'nurse', 'lab_technician', 'patient'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const orderResult = await query(
        `SELECT lo.*, u.full_name AS doctor_name
         FROM lab_orders lo LEFT JOIN users u ON lo.doctor_id = u.user_id
         WHERE lo.order_id = ?`, [id]
      );
      if (!orderResult.rows?.length) return res.status(404).json({ error: 'Lab order not found' });

      const order = orderResult.rows[0];

      // Patients can only download their own results
      if (req.user.role === 'patient') {
        const patRow = await query(
          'SELECT patient_id FROM patients WHERE user_id = ?', [req.user.user_id]
        );
        if (patRow.rows?.[0]?.patient_id !== order.patient_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const patResult = await query(
        'SELECT * FROM patients WHERE patient_id = ?', [order.patient_id]
      );
      const patient = patResult.rows?.[0];
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const pdf = await generateLabResultPDF({ order, patient });
      sendPDF(res, pdf, `Lab-Result-${String(id).padStart(5,'0')}.pdf`);
    } catch (err) {
      console.error('Lab result PDF error:', err);
      res.status(500).json({ error: 'Failed to generate lab result PDF' });
    }
  }
);

// ── GET /pdf/receipt/:paymentId ───────────────────────────────────────────────
router.get('/receipt/:paymentId',
  authorize('admin', 'receptionist', 'doctor', 'patient'),
  async (req, res) => {
    try {
      const { paymentId } = req.params;

      const payResult = await query(
        `SELECT pay.*, r.receipt_number
         FROM payments pay
         LEFT JOIN receipts r ON r.payment_id = pay.payment_id
         WHERE pay.payment_id = ?`, [paymentId]
      );
      if (!payResult.rows?.length) return res.status(404).json({ error: 'Payment not found' });

      const payment = payResult.rows[0];

      // Patient access check
      if (req.user.role === 'patient') {
        const patRow = await query(
          'SELECT patient_id FROM patients WHERE user_id = ?', [req.user.user_id]
        );
        if (patRow.rows?.[0]?.patient_id !== payment.patient_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const [invResult, patResult] = await Promise.all([
        query('SELECT * FROM invoices WHERE invoice_id = ?', [payment.invoice_id]),
        query('SELECT * FROM patients WHERE patient_id = ?', [payment.patient_id]),
      ]);

      const invoice = invResult.rows?.[0];
      const patient = patResult.rows?.[0];
      if (!invoice || !patient) return res.status(404).json({ error: 'Invoice or patient not found' });

      const pdf = await generateReceiptPDF({ payment, invoice, patient });
      sendPDF(res, pdf, `Receipt-${payment.receipt_number || paymentId}.pdf`);
    } catch (err) {
      console.error('Receipt PDF error:', err);
      res.status(500).json({ error: 'Failed to generate receipt PDF' });
    }
  }
);

export default router;