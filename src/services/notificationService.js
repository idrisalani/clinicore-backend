// ============================================
// notificationService.js — SMS + Email
// File: backend/src/services/notificationService.js
//
// Providers:
//   SMS:   Twilio (Nigerian numbers supported)
//   Email: Resend (simple API, generous free tier)
//
// Install:
//   npm install twilio resend
//
// .env variables needed:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_PHONE_NUMBER=+1234567890
//   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   EMAIL_FROM=CliniCore <noreply@yourdomain.com>
//   CLINIC_NAME=CliniCore Healthcare
//   FRONTEND_URL=https://clinicore-frontend-web.vercel.app
// ============================================

import twilio from 'twilio';
import { Resend } from 'resend';

// ── Lazy-init clients (only fail if actually used without config) ──────────────
let twilioClient = null;
let resendClient = null;

const getTwilio = () => {
  if (!twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
    }
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

const getResend = () => {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Resend API key not configured (RESEND_API_KEY)');
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

const CLINIC_NAME  = process.env.CLINIC_NAME  || 'CliniCore Healthcare';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://clinicore-frontend-web.vercel.app';
const FROM_EMAIL   = process.env.EMAIL_FROM   || `${CLINIC_NAME} <noreply@clinicore.ng>`;
const FROM_PHONE   = process.env.TWILIO_PHONE_NUMBER;

// ── Normalize Nigerian phone numbers for Twilio ───────────────────────────────
const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234'))  return `+${digits}`;
  if (digits.startsWith('0'))    return `+234${digits.slice(1)}`;
  if (digits.length === 10)      return `+234${digits}`;
  return `+${digits}`;
};

// ── Core SMS sender ───────────────────────────────────────────────────────────
export const sendSMS = async (to, body) => {
  try {
    const toNormalized = normalizePhone(to);
    if (!toNormalized) throw new Error('Invalid phone number');

    const message = await getTwilio().messages.create({
      body: `[${CLINIC_NAME}] ${body}`,
      from: FROM_PHONE,
      to:   toNormalized,
    });

    console.log(`✅ SMS sent to ${toNormalized}: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`❌ SMS failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ── Core Email sender ─────────────────────────────────────────────────────────
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const { data, error } = await getResend().emails.send({
      from:    FROM_EMAIL,
      to:      Array.isArray(to) ? to : [to],
      subject: `[${CLINIC_NAME}] ${subject}`,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });

    if (error) throw new Error(error.message);
    console.log(`✅ Email sent to ${to}: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ── Log notification to DB (for audit trail) ──────────────────────────────────
// db is passed as first arg (from req.db in routes, or directly in controllers)
export const logNotification = async (db, {
  user_id = null, patient_id = null, type, channel,
  recipient, subject = null, body, status, reference_id = null,
}) => {
  try {
    await db.run(
      `INSERT INTO notifications_log
        (user_id, patient_id, type, channel, recipient, subject, body, status, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, patient_id, type, channel, recipient, subject, body, status, reference_id]
    );
  } catch (err) {
    console.warn('Notification log failed (non-critical):', err.message);
  }
};

// ============================================================
// CLINICAL NOTIFICATION TEMPLATES
// ============================================================

// ── Appointment reminder ──────────────────────────────────────────────────────
export const sendAppointmentReminder = async ({
  patientName, patientPhone, patientEmail,
  doctorName, appointmentDate, appointmentTime,
}) => {
  const dateStr = new Date(appointmentDate).toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const results = {};

  if (patientPhone) {
    results.sms = await sendSMS(
      patientPhone,
      `Hi ${patientName}, reminder: appointment with ${doctorName} on ${dateStr} at ${appointmentTime}. Reply STOP to opt out.`
    );
  }

  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: `Appointment Reminder — ${dateStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#0D9488;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:20px">${CLINIC_NAME}</h1>
          </div>
          <h2 style="color:#1E293B;margin:0 0 12px">Appointment Reminder</h2>
          <p style="color:#475569">Dear <strong>${patientName}</strong>,</p>
          <p style="color:#475569">This is a reminder of your upcoming appointment:</p>
          <div style="background:#F0FDF9;border:1px solid #99F6E4;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0;color:#0F766E"><strong>Doctor:</strong> ${doctorName}</p>
            <p style="margin:4px 0;color:#0F766E"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin:4px 0;color:#0F766E"><strong>Time:</strong> ${appointmentTime}</p>
          </div>
          <p style="color:#94A3B8;font-size:13px">Please arrive 10 minutes early. Call us if you need to reschedule.</p>
        </div>`,
    });
  }
  return results;
};

// ── Queue called ──────────────────────────────────────────────────────────────
export const sendQueueCalledNotification = async ({
  patientName, patientPhone, queueNumber, doctorName,
}) => {
  if (!patientPhone) return { sms: null };
  return {
    sms: await sendSMS(
      patientPhone,
      `${patientName}, queue #${String(queueNumber).padStart(2,'0')} — you are now being called. Please proceed to ${doctorName}'s consulting room.`
    ),
  };
};

// ── Lab result ready ──────────────────────────────────────────────────────────
export const sendLabResultNotification = async ({
  patientName, patientPhone, patientEmail, testName,
}) => {
  const results = {};
  if (patientPhone) {
    results.sms = await sendSMS(
      patientPhone,
      `${patientName}, your ${testName} results are ready. Log in to view: ${FRONTEND_URL}/login`
    );
  }
  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: `Lab Result Ready — ${testName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1E293B">Lab Result Available</h2>
          <p style="color:#475569">Dear <strong>${patientName}</strong>,</p>
          <p style="color:#475569">Your <strong>${testName}</strong> results are now available.</p>
          <a href="${FRONTEND_URL}/login" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            View Results
          </a>
          <p style="color:#94A3B8;font-size:13px">Log in to your patient portal to view the full result and interpretation.</p>
        </div>`,
    });
  }
  return results;
};

// ── Invoice issued ────────────────────────────────────────────────────────────
export const sendInvoiceNotification = async ({
  patientName, patientPhone, patientEmail,
  invoiceNumber, totalAmount, amountDue,
}) => {
  const fmt = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
  const results = {};

  if (patientPhone) {
    results.sms = await sendSMS(
      patientPhone,
      `${patientName}, invoice ${invoiceNumber} issued for ${fmt(totalAmount)}. Amount due: ${fmt(amountDue)}. Log in: ${FRONTEND_URL}/login`
    );
  }
  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: `Invoice ${invoiceNumber} — ${fmt(totalAmount)}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1E293B">Invoice Issued</h2>
          <p style="color:#475569">Dear <strong>${patientName}</strong>,</p>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0;color:#334155"><strong>Invoice:</strong> ${invoiceNumber}</p>
            <p style="margin:4px 0;color:#334155"><strong>Total:</strong> ${fmt(totalAmount)}</p>
            <p style="margin:4px 0;color:#EF4444"><strong>Amount Due:</strong> ${fmt(amountDue)}</p>
          </div>
          <a href="${FRONTEND_URL}/login" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            View Invoice
          </a>
        </div>`,
    });
  }
  return results;
};

// ── Payment received ──────────────────────────────────────────────────────────
export const sendPaymentConfirmation = async ({
  patientName, patientPhone, patientEmail,
  invoiceNumber, amountPaid, remainingBalance,
}) => {
  const fmt = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
  const results = {};

  if (patientPhone) {
    const msg = remainingBalance > 0
      ? `${patientName}, payment of ${fmt(amountPaid)} received for ${invoiceNumber}. Balance: ${fmt(remainingBalance)}.`
      : `${patientName}, payment of ${fmt(amountPaid)} received for ${invoiceNumber}. Thank you — balance cleared!`;
    results.sms = await sendSMS(patientPhone, msg);
  }
  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: `Payment Confirmed — ${invoiceNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#059669">Payment Received</h2>
          <p style="color:#475569">Dear <strong>${patientName}</strong>, thank you for your payment.</p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0;color:#065F46"><strong>Invoice:</strong> ${invoiceNumber}</p>
            <p style="margin:4px 0;color:#065F46"><strong>Amount Paid:</strong> ${fmt(amountPaid)}</p>
            <p style="margin:4px 0;color:${remainingBalance > 0 ? '#EF4444' : '#065F46'}">
              <strong>Remaining Balance:</strong> ${fmt(remainingBalance)}
            </p>
          </div>
        </div>`,
    });
  }
  return results;
};

// ── Prescription issued ───────────────────────────────────────────────────────
// Added — not in doc10 but useful trigger from consultationController
export const sendPrescriptionNotification = async ({
  patientName, patientPhone, patientEmail,
  medications, doctorName,
}) => {
  const results = {};
  if (patientPhone) {
    results.sms = await sendSMS(
      patientPhone,
      `${patientName}, Dr ${doctorName} has prescribed: ${medications}. Collect from the pharmacy.`
    );
  }
  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: 'Prescription Issued',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1E293B">Prescription Issued</h2>
          <p style="color:#475569">Dear <strong>${patientName}</strong>,</p>
          <p style="color:#475569">Dr <strong>${doctorName}</strong> has issued a prescription for you.</p>
          <div style="background:#F0FDF9;border:1px solid #99F6E4;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0;color:#0F766E"><strong>Medications:</strong> ${medications}</p>
          </div>
          <p style="color:#475569">Please collect your medications from the pharmacy.</p>
          <a href="${FRONTEND_URL}/login" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            View Portal
          </a>
        </div>`,
    });
  }
  return results;
};

// ── Patient portal credentials (on registration) ──────────────────────────────
export const sendPortalCredentials = async ({
  patientName, patientPhone, patientEmail,
  loginEmail, defaultPassword,
}) => {
  const results = {};

  if (patientPhone) {
    results.sms = await sendSMS(
      patientPhone,
      `Welcome to ${CLINIC_NAME}! Your portal login: Email: ${loginEmail} | Password: ${defaultPassword} | URL: ${FRONTEND_URL}/login`
    );
  }
  if (patientEmail) {
    results.email = await sendEmail({
      to:      patientEmail,
      subject: 'Welcome — Your Patient Portal Access',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#0D9488;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:20px">${CLINIC_NAME}</h1>
          </div>
          <h2 style="color:#1E293B">Welcome, ${patientName}!</h2>
          <p style="color:#475569">Your patient portal account has been created. Use these credentials to log in:</p>
          <div style="background:#F0FDF9;border:1px solid #99F6E4;border-radius:8px;padding:16px;margin:20px 0;font-family:monospace">
            <p style="margin:4px 0;color:#0F766E"><strong>Email:</strong> ${loginEmail}</p>
            <p style="margin:4px 0;color:#0F766E"><strong>Password:</strong> ${defaultPassword}</p>
          </div>
          <a href="${FRONTEND_URL}/login" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:16px">
            Login to Portal
          </a>
          <p style="color:#94A3B8;font-size:13px">Your password is your first 4 surname letters + last 4 phone digits. You can change it after logging in.</p>
        </div>`,
    });
  }
  return results;
};

// ── Low stock alert (internal — to pharmacist/admin) ─────────────────────────
export const sendLowStockAlert = async ({
  staffEmail, medicationName, currentStock, reorderLevel,
}) => {
  if (!staffEmail) return {};
  return {
    email: await sendEmail({
      to:      staffEmail,
      subject: `Low Stock Alert — ${medicationName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#D97706">Low Stock Alert</h2>
          <p style="color:#475569"><strong>${medicationName}</strong> is running low.</p>
          <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0;color:#92400E"><strong>Current Stock:</strong> ${currentStock} units</p>
            <p style="margin:4px 0;color:#92400E"><strong>Reorder Level:</strong> ${reorderLevel} units</p>
          </div>
          <a href="${FRONTEND_URL}/drug-expiry" style="display:inline-block;background:#D97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            View Pharmacy
          </a>
        </div>`,
    }),
  };
};