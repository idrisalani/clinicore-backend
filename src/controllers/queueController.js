// ============================================
// queueController.js
// File: backend/src/controllers/queueController.js
// ============================================
import { query } from '../config/database.js';
import {
  sendQueueCalledNotification,
  logNotification,
} from '../services/notificationService.js';

const now = () => new Date().toISOString();
const n   = (v) => (v === '' || v === undefined) ? null : v;

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── Notification trigger ──────────────────────────────────────────────────────
const triggerQueueCalled = async (queueId, doctorId) => {
  const result = await query(
    `SELECT q.queue_number, q.patient_id,
            p.first_name, p.last_name, p.phone
     FROM queue q
     JOIN patients p ON q.patient_id = p.patient_id
     WHERE q.queue_id = ?`,
    [queueId]
  );
  const q = result.rows?.[0];
  if (!q || !q.phone) return;

  let doctorName = 'your doctor';
  if (doctorId) {
    const doc = await query('SELECT full_name FROM users WHERE user_id = ?', [doctorId]);
    doctorName = doc.rows?.[0]?.full_name || doctorName;
  }

  await sendQueueCalledNotification({
    patientName:  `${q.first_name} ${q.last_name}`,
    patientPhone: q.phone,
    queueNumber:  q.queue_number,
    doctorName,
  });
  await logNotification(query, {
    patient_id:   q.patient_id,
    type:         'queue_called',
    channel:      'sms',
    recipient:    q.phone,
    body:         `Queue #${String(q.queue_number).padStart(2, '0')} called`,
    status:       'sent',
    reference_id: String(queueId),
  });
};

// ── GET /queue ────────────────────────────────────────────────────────────────
export const getQueue = async (req, res) => {
  try {
    const { status, doctor_id, date } = req.query;
    let where = ["1=1"];
    const params = [];
    if (status)    { where.push('q.status = ?');        params.push(status);    }
    if (doctor_id) { where.push('q.doctor_id = ?');     params.push(doctor_id); }
    const qDate = date || new Date().toISOString().split('T')[0];
    where.push("date(q.check_in_time) = ?");
    params.push(qDate);

    const rows = await getAll(
      `SELECT q.*,
              p.first_name, p.last_name, p.phone, p.date_of_birth,
              u.full_name AS doctor_name
       FROM queue q
       JOIN patients p ON q.patient_id = p.patient_id
       LEFT JOIN users u ON q.doctor_id = u.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY q.priority DESC, q.queue_number ASC`,
      params
    );
    res.json({ queue: rows, date: qDate });
  } catch (err) {
    console.error('getQueue error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /queue/stats ──────────────────────────────────────────────────────────
export const getQueueStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stats = await getOne(
      `SELECT
        COUNT(*)                                                          AS total,
        SUM(CASE WHEN status = 'Waiting'   THEN 1 ELSE 0 END)           AS waiting,
        SUM(CASE WHEN status = 'Called'    THEN 1 ELSE 0 END)           AS called,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)         AS in_progress,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)           AS completed,
        SUM(CASE WHEN status = 'No-Show'   THEN 1 ELSE 0 END)           AS no_show,
        ROUND(AVG(wait_minutes), 1)                                      AS avg_wait_minutes
       FROM queue WHERE date(check_in_time) = ?`,
      [today]
    );
    res.json(stats || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /queue — Add patient to queue ────────────────────────────────────────
export const addToQueue = async (req, res) => {
  try {
    const {
      patient_id, doctor_id, reason_for_visit, priority = 'Normal', notes,
    } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    // Auto-increment queue number for today
    const today = new Date().toISOString().split('T')[0];
    const lastNum = await getOne(
      `SELECT MAX(queue_number) AS max_num FROM queue WHERE date(check_in_time) = ?`,
      [today]
    );
    const queueNumber = (lastNum?.max_num || 0) + 1;

    const result = await query(
      `INSERT INTO queue (
        patient_id, doctor_id, queue_number, priority,
        reason_for_visit, notes, status, check_in_time, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'Waiting', CURRENT_TIMESTAMP, ?)`,
      [
        patient_id, n(doctor_id), queueNumber, priority,
        n(reason_for_visit), n(notes), req.user.user_id,
      ]
    );

    const entry = await getOne(
      `SELECT q.*, p.first_name, p.last_name, p.phone
       FROM queue q JOIN patients p ON q.patient_id = p.patient_id
       WHERE q.queue_id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message:      'Patient added to queue',
      queue_id:     result.lastID,
      queue_number: queueNumber,
      queue_entry:  entry,
    });
  } catch (err) {
    console.error('addToQueue error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /queue/:id/status — Update queue status ────────────────────────────
export const updateQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, doctor_id, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const existing = await getOne('SELECT * FROM queue WHERE queue_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Queue entry not found' });

    const nowStr = now();
    const callTime     = status === 'Called'      ? nowStr : null;
    const startTime    = status === 'In Progress'  ? nowStr : null;
    const endTime      = ['Completed','No-Show','Skipped'].includes(status) ? nowStr : null;
    const waitMins     = endTime && existing.check_in_time
      ? Math.round((new Date(endTime) - new Date(existing.check_in_time)) / 60000)
      : null;
    const effectiveDoctorId = doctor_id || existing.doctor_id;

    await query(
      `UPDATE queue SET
        status       = ?,
        called_time  = COALESCE(?, called_time),
        start_time   = COALESCE(?, start_time),
        end_time     = COALESCE(?, end_time),
        wait_minutes = COALESCE(?, wait_minutes),
        notes        = COALESCE(?, notes),
        doctor_id    = COALESCE(?, doctor_id),
        served_by    = CASE WHEN status IN ('Completed','No-Show','Skipped') THEN ? ELSE served_by END,
        updated_at   = ?
       WHERE queue_id = ?`,
      [
        status, callTime, startTime, endTime, waitMins,
        n(notes), n(doctor_id),
        req.user.user_id, nowStr, id,
      ]
    );

    const updated = await getOne(
      `SELECT q.*, p.first_name, p.last_name, p.phone
       FROM queue q JOIN patients p ON q.patient_id = p.patient_id
       WHERE q.queue_id = ?`,
      [id]
    );

    res.json({ message: 'Queue status updated', queue_entry: updated });

    // Fire-and-forget — SMS patient only when Called
    if (status === 'Called') {
      triggerQueueCalled(id, effectiveDoctorId)
        .catch(e => console.warn('Queue called notification failed (non-critical):', e.message));
    }
  } catch (err) {
    console.error('updateQueueStatus error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /queue/:id — Update queue entry details ───────────────────────────────
export const updateQueueEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, doctor_id, reason_for_visit, notes } = req.body;
    const entry = await getOne('SELECT * FROM queue WHERE queue_id = ?', [id]);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    await query(
      `UPDATE queue SET
        priority         = COALESCE(?, priority),
        doctor_id        = COALESCE(?, doctor_id),
        reason_for_visit = COALESCE(?, reason_for_visit),
        notes            = COALESCE(?, notes),
        updated_at       = ?
       WHERE queue_id = ?`,
      [n(priority), n(doctor_id), n(reason_for_visit), n(notes), now(), id]
    );

    const updated = await getOne(
      `SELECT q.*, p.first_name, p.last_name, p.phone
       FROM queue q JOIN patients p ON q.patient_id = p.patient_id
       WHERE q.queue_id = ?`,
      [id]
    );
    res.json({ message: 'Queue entry updated', queue_entry: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /queue/:id ─────────────────────────────────────────────────────────
export const removeFromQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await getOne('SELECT * FROM queue WHERE queue_id = ?', [id]);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });
    await query('DELETE FROM queue WHERE queue_id = ?', [id]);
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
    const rows = await getAll(
      `SELECT q.*, u.full_name AS doctor_name
       FROM queue q LEFT JOIN users u ON q.doctor_id = u.user_id
       WHERE q.patient_id = ? ORDER BY q.check_in_time DESC LIMIT ?`,
      [patientId, limit]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};