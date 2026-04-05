// ============================================
// Queue Controller
// File: backend/src/controllers/queueController.js
// ============================================

import { query } from '../config/database.js';
import { sendQueueCalledNotification, logNotification } from '../services/notificationService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getOne = async (sql, params = []) => (await query(sql, params)).rows?.[0] || null;
const getAll = async (sql, params = []) => (await query(sql, params)).rows || [];

const today = () => new Date().toISOString().split('T')[0];
const now   = () => new Date().toISOString();

// ── GET /queue — today's full queue ──────────────────────────────────────────
export const getTodayQueue = async (req, res) => {
  try {
    const date     = req.query.date      || today();
    const status   = req.query.status    || '';
    const doctorId = req.query.doctor_id || '';
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 50;
    const offset   = (page - 1) * limit;

    let where  = ['q.queue_date = ?'];
    let params = [date];
    if (status)   { where.push('q.status = ?');    params.push(status);   }
    if (doctorId) { where.push('q.doctor_id = ?'); params.push(doctorId); }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const rows = await getAll(`
      SELECT
        q.*,
        p.first_name, p.last_name, p.phone, p.blood_type, p.allergies,
        p.date_of_birth,
        u.full_name AS doctor_name,
        a.appointment_time,
        a.reason_for_visit AS appointment_reason,
        ROUND((julianday(COALESCE(q.call_time,'now')) -
               julianday(q.check_in_time)) * 1440) AS current_wait_minutes
      FROM queue q
      JOIN patients p ON q.patient_id = p.patient_id
      LEFT JOIN users u ON q.doctor_id = u.user_id
      LEFT JOIN appointments a ON q.appointment_id = a.appointment_id
      ${whereClause}
      ORDER BY q.priority DESC, q.queue_number ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const countRow = await getOne(`SELECT COUNT(*) AS total FROM queue q ${whereClause}`, params);

    const stats = await getOne(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='Waiting'         THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN status='Called'          THEN 1 ELSE 0 END) AS called,
        SUM(CASE WHEN status='In Consultation' THEN 1 ELSE 0 END) AS in_consultation,
        SUM(CASE WHEN status='Completed'       THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='No-Show'         THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN status='Skipped'         THEN 1 ELSE 0 END) AS skipped,
        SUM(CASE WHEN priority='Emergency'     THEN 1 ELSE 0 END) AS emergencies,
        ROUND(AVG(wait_minutes)) AS avg_wait_minutes
      FROM queue WHERE queue_date = ?
    `, [date]);

    res.json({
      queue:  rows,
      stats,
      pagination: { page, limit, total: countRow?.total || 0, totalPages: Math.ceil((countRow?.total || 0) / limit) },
      date,
    });
  } catch (err) {
    console.error('getTodayQueue error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /queue/next ───────────────────────────────────────────────────────────
export const getNextPatient = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || '';
    let sql    = `SELECT q.*, p.first_name, p.last_name, p.phone, p.blood_type, p.allergies
                  FROM queue q JOIN patients p ON q.patient_id = p.patient_id
                  WHERE q.queue_date=? AND q.status='Waiting'`;
    const params = [today()];
    if (doctorId) { sql += ' AND q.doctor_id=?'; params.push(doctorId); }
    sql += ' ORDER BY q.priority DESC, q.queue_number ASC LIMIT 1';
    const next = await getOne(sql, params);
    res.json({ next: next || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /queue/stats ──────────────────────────────────────────────────────────
export const getQueueStats = async (req, res) => {
  try {
    const date  = req.query.date || today();
    const stats = await getOne(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='Waiting'         THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN status='Called'          THEN 1 ELSE 0 END) AS called,
        SUM(CASE WHEN status='In Consultation' THEN 1 ELSE 0 END) AS in_consultation,
        SUM(CASE WHEN status='Completed'       THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='No-Show'         THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN priority='Emergency'     THEN 1 ELSE 0 END) AS emergencies,
        ROUND(AVG(wait_minutes))                                   AS avg_wait_minutes
      FROM queue WHERE queue_date=?
    `, [date]);
    res.json(stats || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /queue/check-in ──────────────────────────────────────────────────────
export const checkInPatient = async (req, res) => {
  try {
    const { patient_id, appointment_id, doctor_id, priority='Normal', reason_for_visit, notes } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    const date = today();
    const existing = await getOne(
      `SELECT queue_id, status FROM queue
       WHERE patient_id=? AND queue_date=? AND status NOT IN ('Completed','No-Show','Skipped')`,
      [patient_id, date]
    );
    if (existing) {
      return res.status(400).json({
        error: 'Patient is already in today\'s queue',
        existing_status: existing.status,
        queue_id:        existing.queue_id,
      });
    }

    const lastNum    = await getOne('SELECT MAX(queue_number) AS last_num FROM queue WHERE queue_date=?', [date]);
    const queueNumber = (lastNum?.last_num || 0) + 1;

    await query(`
      INSERT INTO queue
        (patient_id, appointment_id, doctor_id, queue_number, queue_date,
         status, priority, reason_for_visit, notes, created_by, check_in_time)
      VALUES (?,?,?,?,?,'Waiting',?,?,?,?,?)
    `, [
      patient_id, appointment_id||null, doctor_id||null,
      queueNumber, date, priority,
      reason_for_visit||null, notes||null,
      req.user?.user_id||null, now(),
    ]);

    const newEntry = await getOne(`
      SELECT q.*, p.first_name, p.last_name, p.phone
      FROM queue q JOIN patients p ON q.patient_id = p.patient_id
      WHERE q.queue_date=? AND q.patient_id=? AND q.queue_number=?
    `, [date, patient_id, queueNumber]);

    res.status(201).json({ message: 'Patient checked in successfully', queue_entry: newEntry, queue_number: queueNumber });
  } catch (err) {
    console.error('checkInPatient error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /queue/:id/status ─────────────────────────────────────────────────────
export const updateQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, doctor_id } = req.body;

    const validStatuses = ['Waiting','Called','In Consultation','Completed','No-Show','Skipped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const entry = await getOne('SELECT * FROM queue WHERE queue_id=?', [id]);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    let callTime  = entry.call_time;
    let startTime = entry.start_time;
    let endTime   = entry.end_time;
    let waitMins  = entry.wait_minutes;

    const nowStr = now();
    if (status === 'Called' && !callTime) {
      callTime = nowStr;
      waitMins = Math.round((new Date(nowStr) - new Date(entry.check_in_time)) / 60000);
    }
    if (status === 'In Consultation' && !startTime) startTime = nowStr;
    if (['Completed','No-Show','Skipped'].includes(status) && !endTime) endTime = nowStr;

    await query(`
      UPDATE queue SET
        status=?, call_time=?, start_time=?, end_time=?, wait_minutes=?,
        notes=COALESCE(?,notes), doctor_id=COALESCE(?,doctor_id),
        served_by=CASE WHEN ? IN ('Completed','No-Show','Skipped') THEN ? ELSE served_by END,
        updated_at=?
      WHERE queue_id=?
    `, [
      status, callTime, startTime, endTime, waitMins,
      notes||null, doctor_id||null,
      status, req.user?.user_id||null,
      nowStr, id,
    ]);

    const updated = await getOne(`
      SELECT q.*, p.first_name, p.last_name, p.phone
      FROM queue q JOIN patients p ON q.patient_id = p.patient_id
      WHERE q.queue_id=?
    `, [id]);

    // ── Fire-and-forget: notify patient when Called ───────────────────────────
    if (status === 'Called' && updated?.phone) {
      ;(async () => {
        try {
          let doctorName = 'your doctor';
          const effectiveDoctorId = doctor_id || updated.doctor_id;
          if (effectiveDoctorId) {
            const doc = await getOne('SELECT full_name FROM users WHERE user_id=?', [effectiveDoctorId]);
            doctorName = doc?.full_name || doctorName;
          }

          await sendQueueCalledNotification({
            patientName: `${updated.first_name} ${updated.last_name}`,
            patientPhone: updated.phone,
            queueNumber:  updated.queue_number,
            doctorName,
          });

          await logNotification(query, {
            patient_id:  updated.patient_id,
            type:        'queue_called',
            channel:     'sms',
            recipient:   updated.phone,
            body:        `Queue #${String(updated.queue_number).padStart(2,'0')} called`,
            status:      'sent',
            reference_id:String(id),
          });
        } catch (notifErr) {
          console.warn('Queue called notification failed (non-critical):', notifErr.message);
        }
      })();
    }

    res.json({ message: 'Queue status updated', queue_entry: updated });
  } catch (err) {
    console.error('updateQueueStatus error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /queue/:id ────────────────────────────────────────────────────────────
export const updateQueueEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, doctor_id, reason_for_visit, notes } = req.body;

    const entry = await getOne('SELECT * FROM queue WHERE queue_id=?', [id]);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    await query(`
      UPDATE queue SET
        priority=COALESCE(?,priority),
        doctor_id=COALESCE(?,doctor_id),
        reason_for_visit=COALESCE(?,reason_for_visit),
        notes=COALESCE(?,notes),
        updated_at=?
      WHERE queue_id=?
    `, [priority||null, doctor_id||null, reason_for_visit||null, notes||null, now(), id]);

    const updated = await getOne(`
      SELECT q.*, p.first_name, p.last_name, p.phone
      FROM queue q JOIN patients p ON q.patient_id = p.patient_id
      WHERE q.queue_id=?
    `, [id]);
    res.json({ message: 'Queue entry updated', queue_entry: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /queue/:id ─────────────────────────────────────────────────────────
export const removeFromQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await getOne('SELECT * FROM queue WHERE queue_id=?', [id]);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });
    await query('DELETE FROM queue WHERE queue_id=?', [id]);
    res.json({ message: 'Patient removed from queue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /queue/patient/:patientId ─────────────────────────────────────────────
export const getPatientQueueHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const rows  = await getAll(`
      SELECT q.*, u.full_name AS doctor_name
      FROM queue q LEFT JOIN users u ON q.doctor_id = u.user_id
      WHERE q.patient_id=? ORDER BY q.check_in_time DESC LIMIT ?
    `, [patientId, limit]);
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};