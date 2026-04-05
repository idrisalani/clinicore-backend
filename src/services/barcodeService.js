// ============================================
// barcodeService.js — Barcodes + QR codes
// File: backend/src/services/barcodeService.js
//
// Pure JS — no native dependencies, no canvas.
// Uses puppeteer (already installed for PDFs)
// to render barcode HTML → PNG/PDF.
//
// Install: npm install bwip-js qrcode
// (both are pure JS, zero native deps)
// ============================================

import bwipjs from 'bwip-js';
import QRCode  from 'qrcode';
import { htmlToPdf } from './pdfService.js';

const CLINIC_NAME    = process.env.CLINIC_NAME    || 'CliniCore Healthcare';
const CLINIC_PHONE   = process.env.CLINIC_PHONE   || '+234-800-000-0000';
const FRONTEND_URL   = process.env.FRONTEND_URL   || 'https://clinicore-frontend-web.vercel.app';

// ── Shared helpers ─────────────────────────────────────────────────────────────
const pad    = (n, len = 7) => String(n).padStart(len, '0');
const fmtDob = (d) => d
  ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
  : '';
const getAge = (dob) => dob
  ? Math.floor((Date.now() - new Date(dob)) / 31536000000)
  : null;

// ── Generate barcode as base64 PNG (bwip-js — pure JS) ───────────────────────
const generateBarcodeBase64 = async (value, options = {}) => {
  const png = await bwipjs.toBuffer({
    bcid:        options.format      || 'code128',
    text:        value,
    scale:       options.scale       || 3,
    height:      options.height      || 12,    // mm
    includetext: options.includetext !== false,
    textxalign:  'center',
    textsize:    options.textsize    || 10,
    backgroundcolor: 'ffffff',
    linecolor:   options.linecolor   || '1E293B',
  });
  return png.toString('base64');
};

// ── Generate QR code as data URL (qrcode — pure JS) ──────────────────────────
const generateQRDataUrl = async (data, options = {}) => {
  return QRCode.toDataURL(data, {
    width:  options.width  || 120,
    margin: options.margin || 1,
    color: {
      dark:  options.darkColor  || '#0D9488',
      light: options.lightColor || '#FFFFFF',
    },
    errorCorrectionLevel: options.ecLevel || 'M',
  });
};

// ── Generate QR code as PNG buffer ────────────────────────────────────────────
export const generateQRBuffer = async (data, options = {}) => {
  return QRCode.toBuffer(data, {
    width:  options.width  || 300,
    margin: options.margin || 1,
    color: {
      dark:  options.darkColor  || '#0D9488',
      light: options.lightColor || '#FFFFFF',
    },
  });
};

// ── Generate standalone barcode PNG buffer ────────────────────────────────────
export const generateStandaloneBarcode = async (value, options = {}) => {
  return bwipjs.toBuffer({
    bcid:        options.format  || 'code128',
    text:        value,
    scale:       options.scale   || 4,
    height:      options.height  || 15,
    includetext: true,
    textxalign:  'center',
    textsize:    12,
  });
};

// ============================================================
// 1. PATIENT ID CARD HTML → PDF (CR80 wallet card size)
// ============================================================
export const generatePatientIdCardHTML = async (patient) => {
  const patientCode   = `PAT-${pad(patient.patient_id)}`;
  const portalUrl     = `${FRONTEND_URL}/login`;
  const barcodeBase64 = await generateBarcodeBase64(patientCode, { height: 10, scale: 3 });
  const qrBase64      = await generateQRDataUrl(portalUrl, { width: 110, darkColor: '#0D9488' });
  const age           = getAge(patient.date_of_birth);

  const bloodColors = {
    'O+':'#DBEAFE','O-':'#EDE9FE','A+':'#FCE7F3','A-':'#FEF3C7',
    'B+':'#DCFCE7','B-':'#FEE2E2','AB+':'#F0FDF4','AB-':'#FFF7ED',
  };
  const bloodBg = bloodColors[patient.blood_type] || '#F1F5F9';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  .card {
    width:85.6mm; height:53.98mm;
    background:white; border-radius:4mm;
    overflow:hidden; border:0.5px solid #E2E8F0;
    display:flex; flex-direction:column;
  }
  .card-header {
    background:#0D9488;
    padding:2.5mm 3.5mm;
    display:flex; justify-content:space-between; align-items:center;
  }
  .clinic-name { color:white; font-size:6.5pt; font-weight:700; }
  .card-type   { color:rgba(255,255,255,0.8); font-size:5pt; margin-top:1px; }
  .patient-id  { color:white; font-size:5.5pt; font-family:monospace;
                 background:rgba(0,0,0,0.25); padding:1mm 2mm; border-radius:2mm; }
  .card-body   { display:flex; flex:1; padding:2mm 2.5mm; gap:2mm; align-items:flex-start; }
  .avatar      { width:11mm; height:11mm; border-radius:2mm; background:#CCFBF1;
                 display:flex; align-items:center; justify-content:center;
                 font-size:9pt; font-weight:700; color:#0F766E; flex-shrink:0; }
  .info        { flex:1; }
  .name        { font-size:8pt; font-weight:700; color:#1E293B; margin-bottom:1mm; }
  .detail      { font-size:5.5pt; color:#64748B; margin-bottom:0.5mm; }
  .blood-badge { display:inline-block; background:${bloodBg};
                 padding:0.3mm 1.5mm; border-radius:1.5mm;
                 font-size:5.5pt; font-weight:700; color:#1E293B; }
  .allergy     { font-size:5pt; color:#EF4444; margin-top:0.8mm; }
  .qr-col      { display:flex; flex-direction:column; align-items:center; gap:0.5mm; }
  .qr-col img  { width:11mm; height:11mm; }
  .qr-label    { font-size:4pt; color:#94A3B8; }
  .card-footer { border-top:0.3mm solid #E2E8F0; padding:1mm 2.5mm;
                 display:flex; flex-direction:column; align-items:center; gap:0.3mm; }
  .barcode-img { height:7mm; max-width:100%; }
  .footer-text { font-size:4pt; color:#94A3B8; }
</style></head><body>
  <div class="card">
    <div class="card-header">
      <div>
        <div class="clinic-name">${CLINIC_NAME}</div>
        <div class="card-type">Patient Identification Card</div>
      </div>
      <div class="patient-id">${patientCode}</div>
    </div>
    <div class="card-body">
      <div class="avatar">${(patient.first_name?.[0]||'')}${(patient.last_name?.[0]||'')}</div>
      <div class="info">
        <div class="name">${patient.first_name} ${patient.last_name}</div>
        ${age ? `<div class="detail">${age}y${patient.gender ? ` · ${patient.gender}` : ''}</div>` : ''}
        ${patient.date_of_birth ? `<div class="detail">DOB: ${fmtDob(patient.date_of_birth)}</div>` : ''}
        <div class="detail">${patient.phone || ''}</div>
        ${patient.blood_type ? `<span class="blood-badge">${patient.blood_type}</span>` : ''}
        ${patient.allergies   ? `<div class="allergy">⚠ ${patient.allergies.split(',').slice(0,2).join(', ')}</div>` : ''}
      </div>
      <div class="qr-col">
        <img src="${qrBase64}" alt="QR"/>
        <div class="qr-label">Portal</div>
      </div>
    </div>
    <div class="card-footer">
      <img class="barcode-img" src="data:image/png;base64,${barcodeBase64}" alt="${patientCode}"/>
      <div class="footer-text">${CLINIC_PHONE} · Scan for records</div>
    </div>
  </div>
</body></html>`;

  return { html, barcodeBase64, qrBase64 };
};

// ============================================================
// 2. LAB SPECIMEN LABEL — 50×25mm sticker
// ============================================================
export const generateSpecimenLabelHTML = async (order, patient) => {
  const specimenCode  = `LAB-${pad(order.order_id, 6)}`;
  const barcodeBase64 = await generateBarcodeBase64(specimenCode, { height: 8, scale: 2 });
  const age           = getAge(patient.date_of_birth);

  const priorityColor = order.priority === 'Stat'   ? '#EF4444'
                      : order.priority === 'Urgent' ? '#F97316' : '#64748B';
  const priorityBg    = order.priority === 'Stat'   ? '#FEE2E2'
                      : order.priority === 'Urgent' ? '#FEF3C7' : '#F1F5F9';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; }
  .label { width:50mm; min-height:25mm; background:white;
           border:0.5px solid #CBD5E1; border-radius:1.5mm; padding:1.5mm 2mm; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8mm; }
  .test-name { font-size:7pt; font-weight:700; color:#1E293B; flex:1; }
  .priority  { font-size:5.5pt; font-weight:700; color:${priorityColor};
               background:${priorityBg}; padding:0.3mm 1.5mm; border-radius:1mm; flex-shrink:0; }
  .patient   { font-size:6pt; color:#374151; font-weight:600; }
  .detail    { font-size:5pt; color:#64748B; margin-top:0.3mm; }
  .barcode   { text-align:center; margin-top:1mm; }
  .barcode img { height:8mm; max-width:100%; }
  .clinic    { font-size:4.5pt; color:#94A3B8; text-align:center; margin-top:0.3mm; }
</style></head><body>
  <div class="label">
    <div class="header">
      <div class="test-name">${order.test_name}</div>
      <div class="priority">${order.priority || 'Routine'}</div>
    </div>
    <div class="patient">${patient.first_name} ${patient.last_name}</div>
    <div class="detail">ID: ${pad(patient.patient_id)}${age ? ` · ${age}y` : ''}${patient.blood_type ? ` · ${patient.blood_type}` : ''}</div>
    ${order.specimen_type ? `<div class="detail">Specimen: ${order.specimen_type}</div>` : ''}
    <div class="detail">
      ${new Date(order.order_date).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}
      ${order.doctor_name ? ` · Dr. ${order.doctor_name.split(' ').pop()}` : ''}
    </div>
    <div class="barcode">
      <img src="data:image/png;base64,${barcodeBase64}" alt="${specimenCode}"/>
    </div>
    <div class="clinic">${CLINIC_NAME}</div>
  </div>
</body></html>`;

  return { html, barcodeBase64, specimenCode };
};

// ============================================================
// 3. MEDICATION LABEL — 70×40mm sticker
// ============================================================
export const generateMedicationLabelHTML = async (prescription, patient) => {
  const rxCode        = `RX-${pad(prescription.prescription_id, 6)}`;
  const barcodeBase64 = await generateBarcodeBase64(rxCode, { height: 9, scale: 2 });

  const expiryDate = prescription.expiry_date
    ? new Date(prescription.expiry_date).toLocaleDateString('en-NG',
        { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; }
  .label { width:70mm; min-height:40mm; background:white;
           border:0.5px solid #CBD5E1; border-radius:2mm; overflow:hidden; }
  .lbl-header { background:#0D9488; padding:1.5mm 2mm; }
  .clinic-name { font-size:5.5pt; font-weight:700; color:white; }
  .rx-num     { font-size:5pt; color:rgba(255,255,255,0.8); }
  .lbl-body   { padding:1.5mm 2mm; }
  .drug-name  { font-size:8pt; font-weight:700; color:#1E293B; margin-bottom:0.3mm; }
  .brand-name { font-size:5.5pt; color:#64748B; margin-bottom:0.8mm; }
  .chips      { display:flex; gap:2mm; flex-wrap:wrap; margin:0.8mm 0; }
  .chip       { }
  .chip-label { font-size:4.5pt; color:#94A3B8; text-transform:uppercase; letter-spacing:0.3px; }
  .chip-val   { font-size:6pt; font-weight:600; color:#1E293B; }
  .patient-row{ font-size:5.5pt; color:#374151; border-top:0.3mm solid #E2E8F0;
                padding-top:0.8mm; margin-top:0.8mm; }
  .warning    { font-size:5pt; color:#EF4444; margin-top:0.5mm; }
  .lbl-footer { text-align:center; padding:0.8mm 2mm 1.2mm; border-top:0.3mm solid #F1F5F9; }
  .lbl-footer img { height:9mm; max-width:100%; }
  .expiry     { font-size:4.5pt; color:#94A3B8; margin-top:0.3mm; }
</style></head><body>
  <div class="label">
    <div class="lbl-header">
      <div class="clinic-name">${CLINIC_NAME}</div>
      <div class="rx-num">${rxCode}</div>
    </div>
    <div class="lbl-body">
      <div class="drug-name">${prescription.generic_name}</div>
      ${prescription.brand_name ? `<div class="brand-name">(${prescription.brand_name})</div>` : ''}
      <div class="chips">
        ${prescription.prescribed_dosage ? `<div class="chip"><div class="chip-label">Dose</div><div class="chip-val">${prescription.prescribed_dosage}</div></div>` : ''}
        ${prescription.frequency        ? `<div class="chip"><div class="chip-label">Frequency</div><div class="chip-val">${prescription.frequency}</div></div>` : ''}
        ${prescription.duration_days    ? `<div class="chip"><div class="chip-label">Duration</div><div class="chip-val">${prescription.duration_days}d</div></div>` : ''}
        ${prescription.quantity         ? `<div class="chip"><div class="chip-label">Qty</div><div class="chip-val">${prescription.quantity}</div></div>` : ''}
      </div>
      <div class="patient-row">
        Patient: <strong>${patient.first_name} ${patient.last_name}</strong>
        &nbsp;·&nbsp;
        ${new Date(prescription.prescription_date).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}
      </div>
      ${prescription.special_instructions
        ? `<div class="warning">⚠ ${prescription.special_instructions}</div>`
        : prescription.instructions
        ? `<div style="font-size:5pt;color:#475569;margin-top:0.5mm">${prescription.instructions}</div>`
        : ''}
    </div>
    <div class="lbl-footer">
      <img src="data:image/png;base64,${barcodeBase64}" alt="${rxCode}"/>
      ${expiryDate ? `<div class="expiry">Exp: ${expiryDate} &nbsp;·&nbsp; Refills: ${prescription.refills_remaining ?? 0}</div>` : ''}
    </div>
  </div>
</body></html>`;

  return { html, barcodeBase64, rxCode };
};

// ============================================================
// 4. STANDALONE QR — portal login PNG buffer
// ============================================================
export const generatePatientPortalQR = async () => {
  return generateQRBuffer(`${FRONTEND_URL}/login`, { width: 300, darkColor: '#0D9488' });
};