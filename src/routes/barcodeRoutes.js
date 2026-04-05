// ============================================
// barcodeRoutes.js
// File: backend/src/routes/barcodeRoutes.js
// Mount: app.use('/api/v1/barcode', barcodeRoutes)
// ============================================

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generatePatientIdCardHTML,
  generateSpecimenLabelHTML,
  generateMedicationLabelHTML,
  generatePatientPortalQR,
  generateStandaloneBarcode,
} from '../services/barcodeService.js';
import { htmlToPdf } from '../services/pdfService.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);

// ── Helper: send PNG response ─────────────────────────────────────────────────
const sendPNG = (res, buffer, filename) => {
  res.set({
    'Content-Type':        'image/png',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Length':      buffer.length,
    'Cache-Control':       'public, max-age=3600',
  });
  res.end(buffer);
};

// ── Helper: send PDF response ─────────────────────────────────────────────────
const sendPDF = (res, buffer, filename) => {
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      buffer.length,
  });
  res.end(buffer);
};

// ── GET /barcode/patient/:id/card  — ID card PDF ──────────────────────────────
router.get('/patient/:id/card',
  authorize('admin', 'receptionist', 'nurse', 'doctor'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const patResult = await query(
        'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [id]
      );
      if (!patResult.rows?.length) return res.status(404).json({ error: 'Patient not found' });

      const patient      = patResult.rows[0];
      const { html }     = await generatePatientIdCardHTML(patient);
      const pdf          = await htmlToPdf(html, {
        width:  '85.6mm',
        height: '53.98mm',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      sendPDF(res, pdf, `Patient-ID-${String(id).padStart(7,'0')}.pdf`);
    } catch (err) {
      console.error('Patient ID card error:', err);
      res.status(500).json({ error: 'Failed to generate patient ID card' });
    }
  }
);

// ── GET /barcode/patient/:id/qr  — portal QR PNG ─────────────────────────────
router.get('/patient/:id/qr',
  authorize('admin', 'receptionist', 'nurse', 'doctor', 'patient'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const patResult = await query(
        'SELECT patient_id, first_name, last_name FROM patients WHERE patient_id = ? AND is_active = 1', [id]
      );
      if (!patResult.rows?.length) return res.status(404).json({ error: 'Patient not found' });

      const buffer = await generatePatientPortalQR(patResult.rows[0]);
      sendPNG(res, buffer, `Patient-QR-${id}.png`);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  }
);

// ── GET /barcode/lab/:id/label  — specimen label PDF ─────────────────────────
router.get('/lab/:id/label',
  authorize('admin', 'doctor', 'nurse', 'lab_technician'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const orderResult = await query(
        `SELECT lo.*, u.full_name AS doctor_name
         FROM lab_orders lo LEFT JOIN users u ON lo.doctor_id = u.user_id
         WHERE lo.order_id = ?`, [id]
      );
      if (!orderResult.rows?.length) return res.status(404).json({ error: 'Lab order not found' });

      const order     = orderResult.rows[0];
      const patResult = await query('SELECT * FROM patients WHERE patient_id = ?', [order.patient_id]);
      if (!patResult.rows?.length) return res.status(404).json({ error: 'Patient not found' });

      const { html } = await generateSpecimenLabelHTML(order, patResult.rows[0]);
      const pdf      = await htmlToPdf(html, {
        width:  '50mm',
        height: '25mm',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      sendPDF(res, pdf, `Specimen-Label-LAB-${String(id).padStart(6,'0')}.pdf`);
    } catch (err) {
      console.error('Specimen label error:', err);
      res.status(500).json({ error: 'Failed to generate specimen label' });
    }
  }
);

// ── GET /barcode/prescription/:id/label  — medication label PDF ───────────────
router.get('/prescription/:id/label',
  authorize('admin', 'pharmacist', 'doctor'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const rxResult = await query(
        'SELECT * FROM prescriptions WHERE prescription_id = ?', [id]
      );
      if (!rxResult.rows?.length) return res.status(404).json({ error: 'Prescription not found' });

      const prescription = rxResult.rows[0];
      const patResult    = await query(
        'SELECT * FROM patients WHERE patient_id = ?', [prescription.patient_id]
      );
      if (!patResult.rows?.length) return res.status(404).json({ error: 'Patient not found' });

      const { html } = await generateMedicationLabelHTML(prescription, patResult.rows[0]);
      const pdf      = await htmlToPdf(html, {
        width:  '70mm',
        height: '40mm',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      sendPDF(res, pdf, `Medication-Label-RX-${String(id).padStart(6,'0')}.pdf`);
    } catch (err) {
      console.error('Medication label error:', err);
      res.status(500).json({ error: 'Failed to generate medication label' });
    }
  }
);

// ── GET /barcode/generate?value=X&format=CODE128  — any barcode PNG ───────────
router.get('/generate',
  authorize('admin', 'receptionist', 'lab_technician', 'pharmacist'),
  async (req, res) => {
    try {
      const { value, format, width, height } = req.query;
      if (!value) return res.status(400).json({ error: 'value is required' });

      const buffer = generateStandaloneBarcode(value, {
        format: format || 'CODE128',
        width:  width  ? parseInt(width)  : undefined,
        height: height ? parseInt(height) : undefined,
      });

      sendPNG(res, buffer, `barcode-${value}.png`);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate barcode' });
    }
  }
);

// ── POST /barcode/patient/:id/card/batch  — print cards for multiple patients ──
router.post('/patient/batch/cards',
  authorize('admin', 'receptionist'),
  async (req, res) => {
    try {
      const { patient_ids } = req.body;
      if (!Array.isArray(patient_ids) || patient_ids.length === 0) {
        return res.status(400).json({ error: 'patient_ids array is required' });
      }
      if (patient_ids.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 cards per batch' });
      }

      // Build a combined HTML page with all cards
      const cards = [];
      for (const patId of patient_ids) {
        const patResult = await query(
          'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [patId]
        );
        if (patResult.rows?.length) {
          const { html } = await generatePatientIdCardHTML(patResult.rows[0]);
          // Extract just the card div from the full HTML
          const cardMatch = html.match(/<div class="card">[\s\S]*<\/div>\s*<\/body>/);
          if (cardMatch) cards.push(cardMatch[0].replace('</body>', ''));
        }
      }

      const batchHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #F8FAFC; padding: 10mm; }
  .grid { display: grid; grid-template-columns: repeat(3, 85.6mm); gap: 5mm; }
  .card { width:85.6mm; height:53.98mm; background:white; border-radius:4mm;
          overflow:hidden; border:0.5px solid #E2E8F0; display:flex;
          flex-direction:column; page-break-inside:avoid; }
  /* Re-include card styles from barcodeService */
  .card-header { background:linear-gradient(135deg,#0D9488 0%,#0F766E 100%); padding:3mm 4mm 2.5mm;
                 display:flex; justify-content:space-between; align-items:center; }
  .clinic-name { color:white; font-size:7pt; font-weight:700; letter-spacing:0.3px; }
  .card-type   { color:rgba(255,255,255,0.8); font-size:5.5pt; margin-top:1px; }
  .patient-id  { color:white; font-size:6pt; font-family:monospace;
                 background:rgba(0,0,0,0.2); padding:1.5mm 2.5mm; border-radius:2mm; }
  .card-body   { display:flex; flex:1; padding:2.5mm 3mm; gap:2.5mm; }
  .avatar      { width:12mm; height:12mm; border-radius:2mm; background:#CCFBF1;
                 display:flex; align-items:center; justify-content:center;
                 font-size:10pt; font-weight:700; color:#0F766E; flex-shrink:0; }
  .info        { flex:1; }
  .name        { font-size:8.5pt; font-weight:700; color:#1E293B; margin-bottom:1mm; }
  .detail      { font-size:6pt; color:#64748B; margin-bottom:0.5mm; }
  .blood-badge { display:inline-block; padding:0.5mm 2mm; border-radius:2mm;
                 font-size:6pt; font-weight:700; color:#1E293B; }
  .allergy     { font-size:5.5pt; color:#EF4444; margin-top:1mm; }
  .qr-wrap     { display:flex; flex-direction:column; align-items:center;
                 justify-content:center; gap:0.5mm; }
  .qr-wrap img { width:12mm; height:12mm; }
  .qr-label    { font-size:4.5pt; color:#94A3B8; text-align:center; }
  .card-footer { border-top:0.3mm solid #E2E8F0; padding:1.5mm 3mm;
                 display:flex; flex-direction:column; align-items:center; gap:0.5mm; }
  .card-footer img { height:7mm; }
  .footer-text { font-size:4.5pt; color:#94A3B8; }
</style></head>
<body>
  <div class="grid">
    ${cards.join('\n')}
  </div>
</body></html>`;

      const pdf = await htmlToPdf(batchHTML, {
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
      });

      sendPDF(res, pdf, `Patient-ID-Cards-Batch.pdf`);
    } catch (err) {
      console.error('Batch card error:', err);
      res.status(500).json({ error: 'Failed to generate batch ID cards' });
    }
  }
);

export default router;