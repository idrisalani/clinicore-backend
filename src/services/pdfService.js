// ============================================
// pdfService.js — PDF generation
// File: backend/src/services/pdfService.js
// ============================================

import puppeteer  from 'puppeteer-core';
import chromium   from '@sparticuz/chromium';

const CLINIC_NAME    = process.env.CLINIC_NAME    || 'CliniCore Healthcare';
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || '14, Ero Crescent, off Adejoke Orelope Avenue, Isheri-Olofin, Lagos, Nigeria';
const CLINIC_PHONE   = process.env.CLINIC_PHONE   || '+234-814-114-9819';
const CLINIC_EMAIL   = process.env.CLINIC_EMAIL   || 'idris_a@msn.com';
const CLINIC_RC      = process.env.CLINIC_RC      || '';

// ── Shared helpers ─────────────────────────────────────────────────────────────
const fmt     = (n) => `₦${Number(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const pad     = (n, len = 5) => String(n).padStart(len, '0');

// ── Launch puppeteer (works locally + on Render) ───────────────────────────────
const launchBrowser = async () => {
  const isLocal = process.env.NODE_ENV !== 'production';
  return puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  isLocal ? undefined : await chromium.executablePath(),
    headless:        chromium.headless,
  });
};

// ── Core: render HTML → PDF buffer ────────────────────────────────────────────
export const htmlToPdf = async (html, options = {}) => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin:          { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      ...options,
    });
    return pdf;
  } finally {
    await browser.close();
  }
};

// ── Shared CSS for all PDFs ────────────────────────────────────────────────────
const baseCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1E293B; line-height: 1.5; }
  .teal  { color: #0D9488; }
  .slate { color: #64748B; }
  .red   { color: #EF4444; }
  .green { color: #059669; }
  table  { width: 100%; border-collapse: collapse; }
  th     { background: #F8FAFC; color: #64748B; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E2E8F0; }
  td     { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }
  .badge-paid    { background: #D1FAE5; color: #065F46; }
  .badge-due     { background: #FEE2E2; color: #991B1B; }
  .badge-partial { background: #DBEAFE; color: #1D4ED8; }
  .badge-issued  { background: #CCFBF1; color: #065F46; }
  .header-logo   { background: #0D9488; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .section-title { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; margin-top: 20px; }
  .divider       { border: none; border-top: 1px solid #E2E8F0; margin: 16px 0; }
  .info-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-label    { font-size: 10px; color: #94A3B8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value    { font-size: 12px; color: #1E293B; font-weight: 500; margin-top: 2px; }
  .total-row td  { font-weight: 700; font-size: 13px; border-bottom: none; }
  .grand-total   { background: #F0FDF4; }
  .grand-total td { color: #065F46; font-size: 14px; }
  .footer        { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 10px; color: #94A3B8; }
  .watermark     { color: #E2E8F0; font-size: 10px; }
`;

// ============================================================
// 1. INVOICE PDF
// ============================================================
export const generateInvoicePDF = async ({
  invoice, lineItems = [], payments = [], patient,
}) => {
  const isPaid     = invoice.status === 'Paid';
  const isOverdue  = invoice.status !== 'Paid' && invoice.due_date && new Date(invoice.due_date) < new Date();
  const badgeClass = isPaid ? 'badge-paid' : isOverdue ? 'badge-due' : invoice.status === 'Partially Paid' ? 'badge-partial' : 'badge-issued';

  const lineItemsHTML = lineItems.length > 0
    ? lineItems.map(item => `
        <tr>
          <td>${item.service_name || item.description || '—'}</td>
          <td>${item.service_code || ''}</td>
          <td style="text-align:center">${item.quantity || 1}</td>
          <td style="text-align:right">${fmt(item.unit_price)}</td>
          <td style="text-align:right">${item.discount_percent ? `${item.discount_percent}%` : '—'}</td>
          <td style="text-align:right">${fmt(item.line_total)}</td>
        </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:24px">No line items</td></tr>`;

  const paymentsHTML = payments.length > 0
    ? payments.map(p => `
        <tr>
          <td>${fmtDate(p.payment_date)}</td>
          <td>${p.payment_method || 'Cash'}</td>
          <td>${p.reference_number || '—'}</td>
          <td style="text-align:right;color:#059669;font-weight:600">${fmt(p.amount_paid)}</td>
        </tr>`).join('')
    : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${baseCSS}
  .invoice-header { display: flex; justify-content: space-between; padding: 0; }
  .clinic-info h1 { font-size: 20px; font-weight: 700; }
  .clinic-info p  { font-size: 10px; opacity: 0.85; margin-top: 2px; }
  .invoice-meta   { text-align: right; }
  .invoice-meta .invoice-num { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .amount-box     { background: #F8FAFC; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
  .amount-due-val { font-size: 28px; font-weight: 700; }
</style></head>
<body>
  <div style="max-width:720px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div class="header-logo">
      <div class="invoice-header" style="width:100%">
        <div class="clinic-info">
          <h1>${CLINIC_NAME}</h1>
          <p>${CLINIC_ADDRESS}</p>
          <p>${CLINIC_PHONE} &nbsp;·&nbsp; ${CLINIC_EMAIL}</p>
          ${CLINIC_RC ? `<p>RC: ${CLINIC_RC}</p>` : ''}
        </div>
        <div class="invoice-meta">
          <div class="invoice-num">INVOICE</div>
          <div style="font-size:16px;font-weight:600;margin-top:4px">#${invoice.invoice_number || pad(invoice.invoice_id)}</div>
          <div style="margin-top:8px"><span class="badge ${badgeClass}">${invoice.status}</span></div>
        </div>
      </div>
    </div>
    <div style="padding:24px">
      <div class="info-grid">
        <div>
          <div class="section-title">Bill To</div>
          <div class="info-value" style="font-size:14px;font-weight:700">${patient.first_name} ${patient.last_name}</div>
          <div class="info-value" style="color:#64748B">${patient.phone || ''}</div>
          <div class="info-value" style="color:#64748B">${patient.email || ''}</div>
        </div>
        <div>
          <div class="section-title">Invoice Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div class="info-label">Invoice Date</div><div class="info-value">${fmtDate(invoice.invoice_date)}</div></div>
            <div><div class="info-label">Due Date</div><div class="info-value ${isOverdue ? 'red' : ''}">${fmtDate(invoice.due_date)}</div></div>
            ${invoice.payment_terms ? `<div style="grid-column:1/-1"><div class="info-label">Payment Terms</div><div class="info-value">${invoice.payment_terms}</div></div>` : ''}
          </div>
        </div>
      </div>
      <div class="amount-box">
        <div>
          <div class="info-label">Amount Due</div>
          <div class="amount-due-val ${isPaid ? 'green' : isOverdue ? 'red' : 'teal'}">${fmt(invoice.amount_due)}</div>
        </div>
        <div style="text-align:right">
          <div class="info-label">Total Amount</div>
          <div style="font-size:16px;font-weight:600">${fmt(invoice.total_amount)}</div>
          <div class="info-label" style="margin-top:4px">Amount Paid</div>
          <div style="font-size:14px;font-weight:600;color:#059669">${fmt(invoice.amount_paid)}</div>
        </div>
      </div>
      <div class="section-title">Services / Line Items</div>
      <table>
        <thead><tr><th>Description</th><th>Code</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Discount</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${lineItemsHTML}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="5">Subtotal</td><td style="text-align:right">${fmt(invoice.subtotal)}</td></tr>
          ${invoice.tax_amount > 0 ? `<tr class="total-row"><td colspan="5">Tax (${invoice.tax_percent || invoice.tax_percentage || 0}%)</td><td style="text-align:right">${fmt(invoice.tax_amount)}</td></tr>` : ''}
          ${invoice.discount_amount > 0 ? `<tr class="total-row"><td colspan="5">Discount</td><td style="text-align:right;color:#059669">-${fmt(invoice.discount_amount)}</td></tr>` : ''}
          <tr class="total-row grand-total"><td colspan="5">Total</td><td style="text-align:right">${fmt(invoice.total_amount)}</td></tr>
        </tfoot>
      </table>
      ${payments.length > 0 ? `
      <div class="section-title" style="margin-top:24px">Payment History</div>
      <table>
        <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${paymentsHTML}</tbody>
      </table>` : ''}
      ${invoice.notes ? `<div class="section-title">Notes</div><div style="background:#F8FAFC;border-radius:6px;padding:12px;font-size:11px;color:#475569">${invoice.notes}</div>` : ''}
      <div class="footer">
        <p>${CLINIC_NAME} &nbsp;·&nbsp; ${CLINIC_ADDRESS}</p>
        <p style="margin-top:4px">Generated on ${new Date().toLocaleString('en-NG')} &nbsp;·&nbsp; Thank you for your payment</p>
      </div>
    </div>
  </div>
</body></html>`;

  return htmlToPdf(html);
};

// ============================================================
// 2. PATIENT SUMMARY PDF
// ============================================================
export const generatePatientSummaryPDF = async ({
  patient, appointments = [], consultations = [], labOrders = [], prescriptions = [],
}) => {
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31536000000)
    : null;

  const rowsOrEmpty = (rows, cols, emptyMsg) =>
    rows.length > 0
      ? rows.map(cols).join('')
      : `<tr><td colspan="10" style="text-align:center;color:#94A3B8;padding:16px">${emptyMsg}</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${baseCSS}
  .patient-avatar { width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:white;flex-shrink:0;line-height:60px;text-align:center; }
  .stat-box { background:#F8FAFC;border-radius:6px;padding:12px;text-align:center;flex:1; }
  .stat-val  { font-size:20px;font-weight:700;color:#0D9488; }
  .stat-lbl  { font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px; }
  .allergy-badge { display:inline-block;background:#FEE2E2;color:#991B1B;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;margin:2px; }
  .section-card  { border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:20px; }
  .section-card-header { background:#F8FAFC;padding:10px 14px;font-weight:600;font-size:11px;color:#374151;border-bottom:1px solid #E2E8F0; }
</style></head>
<body>
  <div style="max-width:720px;margin:0 auto;background:white">
    <div class="header-logo" style="border-radius:8px 8px 0 0">
      <div style="display:flex;align-items:center;gap:16px;flex:1">
        <div class="patient-avatar">${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}</div>
        <div>
          <div style="font-size:22px;font-weight:700">${patient.first_name} ${patient.last_name}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px">${age ? `${age} years old` : ''}${patient.gender ? ` · ${patient.gender}` : ''}${patient.blood_type ? ` · Blood Type: ${patient.blood_type}` : ''}</div>
          <div style="font-size:11px;opacity:0.85">${patient.phone || ''} ${patient.email ? `· ${patient.email}` : ''}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;opacity:0.7">${CLINIC_NAME}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:4px">Patient ID: ${pad(patient.patient_id)}</div>
        <div style="font-size:10px;opacity:0.6">Generated: ${new Date().toLocaleDateString('en-NG')}</div>
      </div>
    </div>
    <div style="padding:24px">
      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div class="stat-box"><div class="stat-val">${appointments.length}</div><div class="stat-lbl">Appointments</div></div>
        <div class="stat-box"><div class="stat-val">${consultations.length}</div><div class="stat-lbl">Consultations</div></div>
        <div class="stat-box"><div class="stat-val">${labOrders.length}</div><div class="stat-lbl">Lab Orders</div></div>
        <div class="stat-box"><div class="stat-val">${prescriptions.length}</div><div class="stat-lbl">Prescriptions</div></div>
      </div>
      <div class="section-card">
        <div class="section-card-header">Personal Information</div>
        <div style="padding:14px">
          <div class="info-grid">
            <div><div class="info-label">Date of Birth</div><div class="info-value">${fmtDate(patient.date_of_birth)}</div></div>
            <div><div class="info-label">Gender</div><div class="info-value">${patient.gender || '—'}</div></div>
            <div><div class="info-label">Phone</div><div class="info-value">${patient.phone || '—'}</div></div>
            <div><div class="info-label">Email</div><div class="info-value">${patient.email || '—'}</div></div>
            <div style="grid-column:1/-1"><div class="info-label">Address</div><div class="info-value">${[patient.address, patient.city, patient.state].filter(Boolean).join(', ') || '—'}</div></div>
          </div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-card-header">Medical Information</div>
        <div style="padding:14px">
          <div style="margin-bottom:10px">
            <div class="info-label">Allergies</div>
            <div style="margin-top:4px">${patient.allergies ? patient.allergies.split(',').map(a => `<span class="allergy-badge">${a.trim()}</span>`).join(' ') : '<span style="color:#94A3B8">None recorded</span>'}</div>
          </div>
          <div><div class="info-label">Chronic Conditions</div><div class="info-value" style="margin-top:4px">${patient.chronic_conditions || 'None recorded'}</div></div>
        </div>
      </div>
      ${(patient.insurance_provider || patient.emergency_contact_name) ? `
      <div class="section-card">
        <div class="section-card-header">Insurance & Emergency Contact</div>
        <div style="padding:14px">
          <div class="info-grid">
            ${patient.insurance_provider ? `<div><div class="info-label">Insurance Provider</div><div class="info-value">${patient.insurance_provider}</div></div><div><div class="info-label">Policy Number</div><div class="info-value">${patient.insurance_policy_number || '—'}</div></div>` : ''}
            ${patient.emergency_contact_name ? `<div><div class="info-label">Emergency Contact</div><div class="info-value">${patient.emergency_contact_name}</div></div><div><div class="info-label">Emergency Phone</div><div class="info-value">${patient.emergency_contact_phone || '—'}</div></div>` : ''}
          </div>
        </div>
      </div>` : ''}
      <div class="section-title">Recent Appointments</div>
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>${rowsOrEmpty(appointments.slice(0,10), a => `<tr><td>${fmtDate(a.appointment_date)}</td><td>${a.appointment_time || '—'}</td><td>${a.doctor_name || '—'}</td><td>${a.reason_for_visit || '—'}</td><td><span class="badge ${a.status === 'Completed' ? 'badge-paid' : a.status === 'Cancelled' ? 'badge-due' : 'badge-issued'}">${a.status}</span></td></tr>`, 'No appointments found')}</tbody>
      </table>
      ${prescriptions.length > 0 ? `
      <div class="section-title" style="margin-top:20px">Current Prescriptions</div>
      <table>
        <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Status</th></tr></thead>
        <tbody>${prescriptions.slice(0,10).map(p => `<tr><td>${p.generic_name}${p.brand_name ? ` (${p.brand_name})` : ''}</td><td>${p.prescribed_dosage || '—'}</td><td>${p.frequency || '—'}</td><td><span class="badge ${p.status === 'Active' ? 'badge-paid' : 'badge-issued'}">${p.status}</span></td></tr>`).join('')}</tbody>
      </table>` : ''}
      <div class="footer">
        <p>${CLINIC_NAME} &nbsp;·&nbsp; ${CLINIC_ADDRESS} &nbsp;·&nbsp; ${CLINIC_PHONE}</p>
        <p style="margin-top:4px">Confidential patient record — not for unauthorised disclosure</p>
      </div>
    </div>
  </div>
</body></html>`;

  return htmlToPdf(html);
};

// ============================================================
// 3. LAB RESULT PDF
// ============================================================
export const generateLabResultPDF = async ({ order, patient }) => {
  const resultConfig = {
    Normal:   { bg: '#D1FAE5', color: '#065F46', label: 'Normal'   },
    Abnormal: { bg: '#FEF3C7', color: '#92400E', label: 'Abnormal' },
    Critical: { bg: '#FEE2E2', color: '#991B1B', label: 'Critical' },
  };
  const rc = resultConfig[order.result_status] || { bg: '#F1F5F9', color: '#475569', label: order.result_status || 'Pending' };

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${baseCSS}
  .result-box { border-radius:12px;padding:24px;text-align:center;margin:24px 0; background:${rc.bg}; }
  .result-val { font-size:36px;font-weight:700;color:${rc.color}; }
  .result-lbl { font-size:12px;font-weight:600;color:${rc.color};margin-top:4px; }
</style></head>
<body>
  <div style="max-width:680px;margin:0 auto;background:white">
    <div class="header-logo" style="border-radius:8px 8px 0 0">
      <div><div style="font-size:18px;font-weight:700">${CLINIC_NAME}</div><div style="font-size:10px;opacity:0.8">Laboratory Result Report</div></div>
      <div style="text-align:right;font-size:10px;opacity:0.8"><div>Order #${pad(order.order_id)}</div><div>${new Date().toLocaleDateString('en-NG')}</div></div>
    </div>
    <div style="padding:24px">
      <div class="info-grid" style="margin-bottom:20px">
        <div>
          <div class="section-title">Patient</div>
          <div style="font-size:14px;font-weight:700">${patient.first_name} ${patient.last_name}</div>
          <div style="color:#64748B">${patient.phone || ''}</div>
          ${patient.date_of_birth ? `<div style="color:#64748B">DOB: ${fmtDate(patient.date_of_birth)}</div>` : ''}
          ${patient.blood_type ? `<div style="color:#64748B">Blood Type: ${patient.blood_type}</div>` : ''}
        </div>
        <div>
          <div class="section-title">Test Details</div>
          <div style="font-size:14px;font-weight:700">${order.test_name}</div>
          ${order.test_type ? `<div style="color:#64748B">${order.test_type}</div>` : ''}
          ${order.specimen_type ? `<div style="color:#64748B">Specimen: ${order.specimen_type}</div>` : ''}
          <div style="margin-top:6px"><span style="background:${order.priority === 'Stat' ? '#FEE2E2' : order.priority === 'Urgent' ? '#FEF3C7' : '#F1F5F9'};color:${order.priority === 'Stat' ? '#991B1B' : order.priority === 'Urgent' ? '#92400E' : '#475569'};padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600">${order.priority || 'Routine'}</span></div>
        </div>
      </div>
      <hr class="divider">
      ${order.result_value ? `
      <div class="result-box">
        <div class="result-val">${order.result_value} ${order.result_unit || ''}</div>
        <div class="result-lbl">${rc.label}</div>
        ${order.reference_range ? `<div style="margin-top:8px;font-size:11px;color:${rc.color}">Reference Range: ${order.reference_range}</div>` : ''}
      </div>
      ${order.interpretation ? `<div class="section-title">Interpretation</div><div style="background:#F8FAFC;border-radius:6px;padding:12px;font-size:11px;color:#475569;margin-bottom:16px">${order.interpretation}</div>` : ''}
      ` : `
      <div style="text-align:center;padding:40px;color:#94A3B8">
        <div style="font-size:32px;margin-bottom:8px">⏳</div>
        <div style="font-size:14px;font-weight:600">Result Pending</div>
        <div style="font-size:11px;margin-top:4px">Expected: ${fmtDate(order.expected_date)}</div>
      </div>`}
      <div class="info-grid">
        <div><div class="info-label">Ordered By</div><div class="info-value">${order.doctor_name || '—'}</div></div>
        <div><div class="info-label">Order Date</div><div class="info-value">${fmtDate(order.order_date)}</div></div>
      </div>
      ${order.notes ? `<div class="section-title" style="margin-top:16px">Notes</div><div style="background:#F8FAFC;border-radius:6px;padding:12px;font-size:11px;color:#475569">${order.notes}</div>` : ''}
      <div class="footer">
        <p>${CLINIC_NAME} &nbsp;·&nbsp; ${CLINIC_ADDRESS}</p>
        <p style="margin-top:4px">This report is for medical use only. Please consult your physician for interpretation.</p>
      </div>
    </div>
  </div>
</body></html>`;

  return htmlToPdf(html);
};

// ============================================================
// 4. PAYMENT RECEIPT PDF
// ============================================================
export const generateReceiptPDF = async ({ payment, invoice, patient }) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${baseCSS}
  .receipt-box   { border:2px solid #0D9488;border-radius:12px;padding:32px;max-width:480px;margin:0 auto; }
  .receipt-title { font-size:24px;font-weight:700;color:#0D9488;text-align:center;margin-bottom:4px; }
  .receipt-num   { text-align:center;color:#94A3B8;font-size:11px;margin-bottom:24px; }
  .receipt-amount{ font-size:36px;font-weight:700;color:#059669;text-align:center;margin:20px 0; }
  .receipt-row   { display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9; }
  .receipt-label { color:#64748B;font-size:11px; }
  .receipt-value { font-weight:600;font-size:11px; }
</style></head>
<body>
  <div style="padding:40px;background:white">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;font-weight:700;color:#0D9488">${CLINIC_NAME}</div>
      <div style="font-size:10px;color:#94A3B8">${CLINIC_ADDRESS}</div>
    </div>
    <div class="receipt-box">
      <div class="receipt-title">Receipt</div>
      <div class="receipt-num">${payment.receipt_number || `RCP-${payment.payment_id}`}</div>
      <div class="receipt-amount">${fmt(payment.amount_paid)}</div>
      <div class="receipt-row"><span class="receipt-label">Patient</span><span class="receipt-value">${patient.first_name} ${patient.last_name}</span></div>
      <div class="receipt-row"><span class="receipt-label">Invoice</span><span class="receipt-value">${invoice.invoice_number || `INV-${invoice.invoice_id}`}</span></div>
      <div class="receipt-row"><span class="receipt-label">Payment Date</span><span class="receipt-value">${fmtDate(payment.payment_date)}</span></div>
      <div class="receipt-row"><span class="receipt-label">Payment Method</span><span class="receipt-value">${payment.payment_method || 'Cash'}</span></div>
      ${payment.reference_number ? `<div class="receipt-row"><span class="receipt-label">Reference</span><span class="receipt-value">${payment.reference_number}</span></div>` : ''}
      <div class="receipt-row"><span class="receipt-label">Invoice Total</span><span class="receipt-value">${fmt(invoice.total_amount)}</span></div>
      <div class="receipt-row"><span class="receipt-label">Total Paid</span><span class="receipt-value" style="color:#059669">${fmt(invoice.amount_paid)}</span></div>
      <div class="receipt-row" style="border-bottom:none"><span class="receipt-label">Balance</span>
        <span class="receipt-value" style="color:${invoice.amount_due > 0 ? '#EF4444' : '#059669'}">${fmt(invoice.amount_due)}</span>
      </div>
    </div>
    <div class="footer" style="margin-top:24px">
      <p>${CLINIC_NAME} &nbsp;·&nbsp; ${CLINIC_PHONE}</p>
      <p style="margin-top:4px">Thank you for your payment. Please keep this receipt for your records.</p>
    </div>
  </div>
</body></html>`;

  return htmlToPdf(html, { format: 'A5' });
};

// ============================================================
// 5. CONSULTATION PDF  ← NEW
// ============================================================
export const generateConsultationPDF = async (c) => {
  const patientName  = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  const consultDate  = fmtDate(c.consultation_date);
  const dob          = fmtDate(c.date_of_birth);

  const statusColors = {
    draft:     { bg: '#FEF3C7', color: '#92400E' },
    completed: { bg: '#D1FAE5', color: '#065F46' },
    signed:    { bg: '#DBEAFE', color: '#1D4ED8' },
    reviewed:  { bg: '#EDE9FE', color: '#5B21B6' },
  };
  const sc = statusColors[(c.status || 'draft').toLowerCase()] || statusColors.draft;

  // Only render a section if at least one value in it is present
  const hasVitals = c.vital_signs_bp || c.vital_signs_temp || c.vital_signs_pulse || c.vital_signs_respiration;
  const hasDiagnosis = c.diagnosis || c.treatment_plan || c.medications_prescribed || c.procedures;
  const hasFollowup = c.follow_up_date || c.follow_up_notes || c.referral_needed;

  const sectionHeader = (title, color) =>
    `<div style="background:${color}18;border-left:3px solid ${color};padding:7px 12px;font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:0">${title}</div>`;

  const dataRow = (label, value) => !value ? '' : `
    <tr>
      <td style="width:30%;font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.3px;padding:7px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top">${label}</td>
      <td style="font-size:11px;color:#1E293B;padding:7px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;white-space:pre-wrap">${value}</td>
    </tr>`;

  const vitalCard = (label, value, unit) => `
    <div style="flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px;text-align:center">
      <div style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <div style="font-size:18px;font-weight:700;color:${value ? '#1E293B' : '#CBD5E1'};margin-top:4px">${value || '—'}</div>
      ${value && unit ? `<div style="font-size:9px;color:#94A3B8;margin-top:1px">${unit}</div>` : ''}
    </div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1E293B;line-height:1.5; }
  .section { border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:14px; }
  table { width:100%;border-collapse:collapse; }
  .footer { margin-top:28px;padding-top:12px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:9px;color:#94A3B8; }
</style></head>
<body>
<div style="max-width:720px;margin:0 auto;padding:0;background:white">

  <!-- Teal header -->
  <div style="background:#0D9488;color:white;padding:20px 24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:20px;font-weight:700">${CLINIC_NAME}</div>
      <div style="font-size:10px;opacity:0.8;margin-top:2px">${CLINIC_ADDRESS}</div>
      <div style="font-size:10px;opacity:0.8">${CLINIC_PHONE} · ${CLINIC_EMAIL}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:700">Consultation Record</div>
      <div style="font-size:12px;opacity:0.85;margin-top:3px">CONS-${pad(c.consultation_id)}</div>
      <div style="font-size:10px;opacity:0.75;margin-top:2px">${consultDate}</div>
    </div>
  </div>

  <div style="padding:20px 24px">

    <!-- Patient banner -->
    <div style="background:#F0FDFA;border:1px solid #99F6E4;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div>
        <div style="font-size:18px;font-weight:700;color:#0D9488">${patientName}</div>
        <div style="font-size:10px;color:#475569;margin-top:3px">
          DOB: ${dob} &nbsp;·&nbsp; Gender: ${c.gender || '—'} &nbsp;·&nbsp; Blood Type: ${c.blood_type || 'Unknown'} &nbsp;·&nbsp; Phone: ${c.phone || '—'}
        </div>
        ${c.allergies ? `<div style="font-size:10px;color:#DC2626;font-weight:600;margin-top:3px">⚠ Allergies: ${c.allergies}</div>` : ''}
      </div>
      <div style="background:${sc.bg};color:${sc.color};padding:5px 14px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;margin-left:12px">
        ${c.status || 'Draft'}
      </div>
    </div>

    <!-- Chief Complaint & History -->
    <div class="section">
      ${sectionHeader('Chief Complaint & History', '#3B82F6')}
      ${c.chief_complaint ? `
      <div style="background:#EFF6FF;padding:10px 12px;border-bottom:1px solid #BFDBFE">
        <div style="font-size:9px;font-weight:700;color:#3B82F6;text-transform:uppercase;margin-bottom:3px">Chief Complaint</div>
        <div style="font-size:13px;font-weight:600;color:#1E293B">${c.chief_complaint}</div>
      </div>` : ''}
      <table>
        ${dataRow('History of Present Illness', c.history_of_present_illness)}
        ${dataRow('Past Medical History', c.past_medical_history)}
        ${dataRow('Current Medications', c.medications)}
      </table>
    </div>

    <!-- Vital Signs -->
    ${hasVitals ? `
    <div class="section">
      ${sectionHeader('Vital Signs', '#10B981')}
      <div style="display:flex;gap:10px;padding:12px">
        ${vitalCard('Blood Pressure', c.vital_signs_bp, 'mmHg')}
        ${vitalCard('Temperature', c.vital_signs_temp, '°C')}
        ${vitalCard('Pulse', c.vital_signs_pulse, 'bpm')}
        ${vitalCard('Respiration', c.vital_signs_respiration, '/min')}
      </div>
    </div>` : ''}

    <!-- Physical Examination -->
    ${c.physical_examination ? `
    <div class="section">
      ${sectionHeader('Physical Examination', '#F59E0B')}
      <div style="padding:10px 12px;font-size:11px;color:#1E293B;white-space:pre-wrap">${c.physical_examination}</div>
    </div>` : ''}

    <!-- Diagnosis & Treatment -->
    ${hasDiagnosis ? `
    <div class="section">
      ${sectionHeader('Diagnosis & Treatment', '#EF4444')}
      ${c.diagnosis ? `
      <div style="background:#FFF1F2;padding:10px 12px;border-bottom:1px solid #FECDD3">
        <div style="font-size:9px;font-weight:700;color:#EF4444;text-transform:uppercase;margin-bottom:3px">Primary Diagnosis${c.diagnosis_icd ? ` · ICD: ${c.diagnosis_icd}` : ''}</div>
        <div style="font-size:14px;font-weight:700;color:#BE123C">${c.diagnosis}</div>
      </div>` : ''}
      <table>
        ${dataRow('Treatment Plan', c.treatment_plan)}
        ${dataRow('Medications Prescribed', c.medications_prescribed)}
        ${dataRow('Procedures', c.procedures)}
      </table>
    </div>` : ''}

    <!-- Follow-up & Referral -->
    ${hasFollowup ? `
    <div class="section">
      ${sectionHeader('Follow-up & Referral', '#8B5CF6')}
      <table>
        ${dataRow('Follow-up Date', c.follow_up_date ? fmtDate(c.follow_up_date) : null)}
        ${dataRow('Instructions', c.follow_up_notes)}
        ${c.referral_needed ? dataRow('Referral', `Yes — ${c.referral_to || 'Specialist not specified'}`) : ''}
      </table>
    </div>` : ''}

    <!-- Attending Physician -->
    ${c.doctor_name ? `
    <div class="section">
      ${sectionHeader('Attending Physician', '#0D9488')}
      <table>
        ${dataRow('Doctor', c.doctor_name)}
        ${dataRow('Additional Notes', c.notes)}
      </table>
    </div>` : ''}

    <div class="footer">
      <span>${CLINIC_NAME} · Generated ${new Date().toLocaleString('en-NG')}</span>
      <span>CONFIDENTIAL — Authorised Healthcare Use Only</span>
    </div>

  </div>
</div>
</body></html>`;

  return htmlToPdf(html);
};