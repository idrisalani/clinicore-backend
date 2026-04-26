// ============================================
// appointmentController.js
// File: backend/src/controllers/appointmentController.js
// ============================================
import { query } from '../config/database.js';
import db from '../config/database.js';
import Joi from 'joi';
import {
  sendAppointmentReminder,
  logNotification,
} from '../services/notificationService.js';
import { decryptFields, decryptRows, PHI_FIELDS } from '../utils/encryption.js';

// PHI fields joined from patients table that need decryption
const PATIENT_PHI = PHI_FIELDS.patients;

const n = (v) => (v === '' || v === undefined) ? null : v;

const appointmentSchema = Joi.object({
  patient_id:       Joi.number().integer().required(),
  doctor_id:        Joi.number().integer().optional().allow(null, ''),
  appointment_date: Joi.string().required(),
  appointment_time: Joi.string().optional().allow(null, ''),
  duration_minutes: Joi.number().integer().optional().default(30),
  reason_for_visit: Joi.string().trim().optional().allow(null, ''),
  notes:            Joi.string().optional().allow(null, ''),
  status:           Joi.string().valid('Scheduled','Completed','Cancelled','No-Show','Rescheduled').optional().default('Scheduled'),
  is_confirmed:     Joi.number().integer().optional().default(0),
});

// ── Notification trigger ──────────────────────────────────────────────────────
const triggerAppointmentReminder = async (appointmentId) => {
  const result = await query(
    `SELECT a.appointment_date, a.appointment_time,
            p.first_name, p.last_name, p.phone, p.email, p.patient_id,
            u.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     LEFT JOIN users u ON a.doctor_id = u.user_id
     WHERE a.appointment_id = ?`,
    [appointmentId]
  );
  const raw = result.rows?.[0];
  if (!raw) return;
  const a = decryptFields(raw, PATIENT_PHI);  // decrypt phone/email before sending
  await sendAppointmentReminder({
    patientName:     `${a.first_name} ${a.last_name}`,
    patientPhone:    a.phone,
    patientEmail:    a.email,
    doctorName:      a.doctor_name || 'your doctor',
    appointmentDate: a.appointment_date,
    appointmentTime: a.appointment_time || 'as scheduled',
  });
  await logNotification(db, {
    patient_id:   a.patient_id,
    type:         'appointment_reminder',
    channel:      a.phone && a.email ? 'both' : a.phone ? 'sms' : 'email',
    recipient:    a.phone || a.email,
    body:         `Appointment reminder — ${a.appointment_date}`,
    status:       'sent',
    reference_id: String(appointmentId),
  });
};

// ── GET /appointments ─────────────────────────────────────────────────────────
export const getAllAppointments = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, patient_id, doctor_id,
      status, date, start_date, end_date,
    } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    const params = [];
    if (patient_id) { where.push('a.patient_id = ?');       params.push(patient_id); }
    if (doctor_id)  { where.push('a.doctor_id = ?');        params.push(doctor_id);  }
    if (status)     { where.push('a.status = ?');           params.push(status);     }
    if (date)       { where.push('a.appointment_date = ?'); params.push(date);       }
    if (start_date) { where.push('a.appointment_date >= ?');params.push(start_date); }
    if (end_date)   { where.push('a.appointment_date <= ?');params.push(end_date);   }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await query(
      `SELECT COUNT(*) as n FROM appointments a ${w}`, params
    );
    const rows = await query(
      `SELECT a.*,
              p.first_name, p.last_name, p.phone,
              u.full_name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       LEFT JOIN users u ON a.doctor_id = u.user_id
       ${w}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      appointments: decryptRows(rows.rows || [], PATIENT_PHI),
      pagination: {
        total: total.rows[0]?.n || 0, page: +page,
        limit: +limit, totalPages: Math.ceil((total.rows[0]?.n || 0) / limit),
      },
    });
  } catch (err) {
    console.error('getAllAppointments error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /appointments/:id ─────────────────────────────────────────────────────
export const getAppointmentById = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*,
              p.first_name, p.last_name, p.phone, p.email,
              u.full_name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       LEFT JOIN users u ON a.doctor_id = u.user_id
       WHERE a.appointment_id = ?`,
      [req.params.id]
    );
    if (!result.rows?.length)
      return res.status(404).json({ error: 'Appointment not found' });
    res.json({ appointment: decryptFields(result.rows[0], PATIENT_PHI) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /appointments/patient/:patientId ──────────────────────────────────────
export const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10, status } = req.query;
    let where = 'WHERE a.patient_id = ?';
    const params = [patientId];
    if (status) { where += ' AND a.status = ?'; params.push(status); }
    const rows = await query(
      `SELECT a.*, u.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN users u ON a.doctor_id = u.user_id
       ${where}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT ?`,
      [...params, limit]
    );
    res.json({ appointments: decryptRows(rows.rows || [], PATIENT_PHI) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /appointments ────────────────────────────────────────────────────────
export const createAppointment = async (req, res) => {
  try {
    const { error, value } = appointmentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      patient_id, doctor_id, appointment_date, appointment_time,
      duration_minutes, reason_for_visit, notes, status, is_confirmed,
    } = value;

    const result = await query(
      `INSERT INTO appointments (
        patient_id, doctor_id, appointment_date, appointment_time,
        duration_minutes, reason_for_visit, notes, status, is_confirmed,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        patient_id, n(doctor_id), appointment_date, n(appointment_time),
        duration_minutes || 30, n(reason_for_visit), n(notes),
        status || 'Scheduled', is_confirmed ?? 0,
        req.user.user_id,
      ]
    );

    console.log(`✅ Appointment created: ID ${result.lastID}`);
    res.status(201).json({
      message:        'Appointment created successfully',
      appointment_id: result.lastID,
    });

    // Fire-and-forget — send booking confirmation to patient
    triggerAppointmentReminder(result.lastID)
      .catch(e => console.warn('Appointment reminder failed (non-critical):', e.message));
  } catch (err) {
    console.error('createAppointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
};

// ── PUT /appointments/:id ─────────────────────────────────────────────────────
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(
      'SELECT appointment_id FROM appointments WHERE appointment_id = ?', [id]
    );
    if (!existing.rows?.length)
      return res.status(404).json({ error: 'Appointment not found' });

    const {
      doctor_id, appointment_date, appointment_time, duration_minutes,
      reason_for_visit, notes, status, is_confirmed,
    } = req.body;

    await query(
      `UPDATE appointments SET
        doctor_id        = COALESCE(?, doctor_id),
        appointment_date = COALESCE(?, appointment_date),
        appointment_time = COALESCE(?, appointment_time),
        duration_minutes = COALESCE(?, duration_minutes),
        reason_for_visit = COALESCE(?, reason_for_visit),
        notes            = COALESCE(?, notes),
        status           = COALESCE(?, status),
        is_confirmed     = COALESCE(?, is_confirmed),
        updated_by       = ?,
        updated_at       = CURRENT_TIMESTAMP
       WHERE appointment_id = ?`,
      [
        n(doctor_id), n(appointment_date), n(appointment_time),
        n(duration_minutes), n(reason_for_visit), n(notes),
        n(status), n(is_confirmed), req.user.user_id, id,
      ]
    );
    res.json({ message: 'Appointment updated', appointment_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /appointments/:id ──────────────────────────────────────────────────
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(
      'SELECT appointment_id FROM appointments WHERE appointment_id = ?', [id]
    );
    if (!existing.rows?.length)
      return res.status(404).json({ error: 'Appointment not found' });
    await query('DELETE FROM appointments WHERE appointment_id = ?', [id]);
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /appointments/stats ───────────────────────────────────────────────────
export const getAppointmentStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*)                                                         AS total,
        SUM(CASE WHEN status = 'Scheduled'  THEN 1 ELSE 0 END)          AS scheduled,
        SUM(CASE WHEN status = 'Completed'  THEN 1 ELSE 0 END)          AS completed,
        SUM(CASE WHEN status = 'Cancelled'  THEN 1 ELSE 0 END)          AS cancelled,
        SUM(CASE WHEN status = 'No-Show'    THEN 1 ELSE 0 END)          AS no_show,
        SUM(CASE WHEN appointment_date = date('now') THEN 1 ELSE 0 END) AS today
      FROM appointments
    `);
    res.json(stats.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /appointments/doctor/:doctorId/availability ───────────────────────────
// Returns available 30-min slots for a doctor on a given date
export const getDoctorAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });

    // Get booked slots for this doctor on this date
    const booked = await query(
      `SELECT appointment_time, duration_minutes
       FROM appointments
       WHERE doctor_id = ? AND appointment_date = ?
         AND status NOT IN ('Cancelled','No-Show')
       ORDER BY appointment_time ASC`,
      [doctorId, date]
    );
    const bookedSlots = booked.rows || [];

    // Generate 30-min slots from 08:00 to 17:00
    const available = [];
    for (let hour = 8; hour < 17; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
        const slotStart = hour * 60 + min;

        const isBooked = bookedSlots.some(slot => {
          const [sh, sm]  = slot.appointment_time.split(':').map(Number);
          const start     = sh * 60 + sm;
          const end       = start + (slot.duration_minutes || 30);
          return slotStart >= start && slotStart < end;
        });

        if (!isBooked) available.push(timeStr);
      }
    }

    res.json({
      date,
      doctor_id:       doctorId,
      available_slots: available,
      booked_slots:    bookedSlots.map(s => s.appointment_time),
    });
  } catch (err) {
    console.error('getDoctorAvailability error:', err);
    res.status(500).json({ error: err.message });
  }
};