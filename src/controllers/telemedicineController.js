// ============================================
// telemedicineController.js
// File: backend/src/controllers/telemedicineController.js
//
// Video provider: Daily.co (free tier: 10k min/month)
// .env required:
//   DAILY_API_KEY=your_daily_co_api_key
//   DAILY_DOMAIN=yoursubdomain   (just the subdomain, e.g. "clinicore")
// ============================================
import { query } from '../config/database.js';

const DAILY_KEY    = process.env.DAILY_API_KEY;
const DAILY_DOMAIN = process.env.DAILY_DOMAIN || 'clinicore';
const DAILY_BASE   = 'https://api.daily.co/v1';

// ── Daily.co API helper ───────────────────────────────────────────────────────
const dailyFetch = async (path, method = 'GET', body = null) => {
  if (!DAILY_KEY) throw new Error('DAILY_API_KEY not configured in .env');
  const res = await fetch(`${DAILY_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DAILY_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Daily.co API error: ${res.status}`);
  }
  return res.json();
};

const getOne = async (sql, params = []) => {
  const r = await query(sql, params);
  return r.rows?.[0] || null;
};

// ── POST /telemedicine/sessions — Create a new session ────────────────────────
export const createSession = async (req, res) => {
  try {
    const { appointment_id } = req.body;
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id required' });

    // Fetch appointment + patient + doctor
    const appt = await getOne(
      `SELECT a.*, p.first_name, p.last_name, p.email AS patient_email, p.phone,
              u.full_name AS doctor_name, u.email AS doctor_email
       FROM appointments a
       JOIN patients p  ON a.patient_id = p.patient_id
       LEFT JOIN users u ON a.doctor_id  = u.user_id
       WHERE a.appointment_id = ?`,
      [appointment_id]
    );
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    // Decrypt PHI fields before using phone/email
    const { decryptFields, PHI_FIELDS } = await import('../utils/encryption.js');
    const decryptedAppt = decryptFields(appt, PHI_FIELDS.patients);
    appt.phone        = decryptedAppt.phone;
    appt.patient_email= decryptedAppt.email;
    if (!appt.doctor_id) return res.status(400).json({ error: 'Please assign a doctor to this appointment before creating a video session.' });

    // Check for existing session
    const existing = await getOne(
      'SELECT * FROM telemedicine_sessions WHERE appointment_id = ? AND status != ?',
      [appointment_id, 'Cancelled']
    );
    if (existing) {
      return res.json({
        message:    'Session already exists',
        session:    existing,
        doctor_url: existing.room_url,
        patient_url:`${existing.room_url}?t=${existing.patient_token}`,
      });
    }

    // Unique room name
    const roomName = `clinicore-${appointment_id}-${Date.now()}`;
    const scheduledAt = new Date(`${appt.appointment_date}T${appt.appointment_time || '00:00'}:00`);
    const expiresAt   = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000); // +3h

    // Create Daily.co room
    const room = await dailyFetch('/rooms', 'POST', {
      name:       roomName,
      privacy:    'private',
      properties: {
        exp:              Math.floor(expiresAt.getTime() / 1000),
        max_participants: 2,
        enable_chat:      true,
        enable_screenshare: false,
        start_video_off:  false,
        start_audio_off:  false,
        lang:             'en',
      },
    });

    // Create doctor token (owner — can manage room)
    const doctorToken = await dailyFetch('/meeting-tokens', 'POST', {
      properties: {
        room_name:  roomName,
        user_name:  `Dr. ${appt.doctor_name}`,
        user_id:    `doctor-${appt.doctor_id}`,
        is_owner:   true,
        exp:        Math.floor(expiresAt.getTime() / 1000),
      },
    });

    // Create patient token (participant)
    const patientToken = await dailyFetch('/meeting-tokens', 'POST', {
      properties: {
        room_name:  roomName,
        user_name:  `${appt.first_name} ${appt.last_name}`,
        user_id:    `patient-${appt.patient_id}`,
        is_owner:   false,
        exp:        Math.floor(expiresAt.getTime() / 1000),
      },
    });

    // Save session to DB
    const result = await query(
      `INSERT INTO telemedicine_sessions (
        appointment_id, patient_id, doctor_id,
        room_name, room_url, doctor_token, patient_token,
        privacy, status, scheduled_at, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        appointment_id, appt.patient_id, appt.doctor_id,
        roomName, room.url,
        doctorToken.token, patientToken.token,
        'private', 'Scheduled',
        scheduledAt.toISOString(), req.user.user_id,
      ]
    );

    // Update appointment type
    await query(
      `UPDATE appointments SET appointment_type='Telemedicine', meeting_url=?, meeting_room_id=? WHERE appointment_id=?`,
      [room.url, roomName, appointment_id]
    );

    const session = await getOne('SELECT * FROM telemedicine_sessions WHERE session_id = ?', [result.lastID]);

    res.status(201).json({
      message:     'Telemedicine session created',
      session,
      doctor_url:  `${room.url}?t=${doctorToken.token}`,
      patient_url: `${room.url}?t=${patientToken.token}`,
    });
  } catch (err) {
    console.error('createSession error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /telemedicine/sessions — List sessions ────────────────────────────────
export const getSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', doctor_id = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status)    { where += ' AND ts.status = ?';    params.push(status); }
    if (doctor_id) { where += ' AND ts.doctor_id = ?'; params.push(doctor_id); }

    // Doctors only see their own sessions unless admin
    const role = (req.user.role || '').toLowerCase();
    if (role === 'doctor') {
      where += ' AND ts.doctor_id = ?';
      params.push(req.user.user_id);
    } else if (role === 'patient') {
      where += ' AND ts.patient_id = ?';
      params.push(req.user.user_id);
    }

    const [countRes, rows] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM telemedicine_sessions ts ${where}`, params),
      query(
        `SELECT ts.*,
                p.first_name, p.last_name, p.phone,
                u.full_name AS doctor_name,
                a.appointment_date, a.appointment_time, a.reason_for_visit
         FROM telemedicine_sessions ts
         JOIN patients p    ON ts.patient_id = p.patient_id
         JOIN users u       ON ts.doctor_id  = u.user_id
         JOIN appointments a ON ts.appointment_id = a.appointment_id
         ${where}
         ORDER BY ts.scheduled_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      sessions: rows.rows || [],
      pagination: {
        total: countRes.rows[0]?.total || 0,
        page: parseInt(page),
        totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

// ── GET /telemedicine/sessions/:id ────────────────────────────────────────────
export const getSessionById = async (req, res) => {
  try {
    const session = await getOne(
      `SELECT ts.*,
              p.first_name, p.last_name, p.phone, p.email AS patient_email,
              u.full_name AS doctor_name, u.email AS doctor_email,
              a.appointment_date, a.appointment_time, a.reason_for_visit
       FROM telemedicine_sessions ts
       JOIN patients p    ON ts.patient_id = p.patient_id
       JOIN users u       ON ts.doctor_id  = u.user_id
       JOIN appointments a ON ts.appointment_id = a.appointment_id
       WHERE ts.session_id = ?`,
      [req.params.id]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Return token appropriate to the caller's role
    const role = (req.user.role || '').toLowerCase();
    const isDoctor  = role === 'admin' || role === 'doctor' || session.doctor_id === req.user.user_id;
    const joinToken = isDoctor ? session.doctor_token : session.patient_token;
    const joinUrl   = joinToken ? `${session.room_url}?t=${joinToken}` : session.room_url;

    res.json({ session, join_url: joinUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

// ── POST /telemedicine/sessions/:id/start ─────────────────────────────────────
export const startSession = async (req, res) => {
  try {
    await query(
      `UPDATE telemedicine_sessions SET status='Active', started_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE session_id=?`,
      [req.params.id]
    );
    res.json({ message: 'Session started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session' });
  }
};

// ── POST /telemedicine/sessions/:id/end ───────────────────────────────────────
export const endSession = async (req, res) => {
  try {
    const { notes } = req.body;
    const session = await getOne('SELECT * FROM telemedicine_sessions WHERE session_id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const durationMins = session.started_at
      ? Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)
      : null;

    await query(
      `UPDATE telemedicine_sessions SET
        status='Completed', ended_at=CURRENT_TIMESTAMP,
        duration_minutes=?, notes=?, updated_at=CURRENT_TIMESTAMP
       WHERE session_id=?`,
      [durationMins, notes || null, req.params.id]
    );

    // Update appointment status
    await query(
      `UPDATE appointments SET status='Completed' WHERE appointment_id=?`,
      [session.appointment_id]
    );

    // Delete Daily.co room to free capacity
    if (DAILY_KEY) {
      dailyFetch(`/rooms/${session.room_name}`, 'DELETE').catch(e => console.warn('Daily room delete failed:', e.message));
    }

    res.json({ message: 'Session ended', duration_minutes: durationMins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end session' });
  }
};

// ── DELETE /telemedicine/sessions/:id — Cancel ────────────────────────────────
export const cancelSession = async (req, res) => {
  try {
    const session = await getOne('SELECT room_name FROM telemedicine_sessions WHERE session_id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await query(
      `UPDATE telemedicine_sessions SET status='Cancelled', updated_at=CURRENT_TIMESTAMP WHERE session_id=?`,
      [req.params.id]
    );

    if (DAILY_KEY) {
      dailyFetch(`/rooms/${session.room_name}`, 'DELETE').catch(e => console.warn('Daily room delete failed:', e.message));
    }

    res.json({ message: 'Session cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel session' });
  }
};

// ── GET /telemedicine/stats ───────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const [total, byStatus, avgDuration, today] = await Promise.all([
      query('SELECT COUNT(*) as c FROM telemedicine_sessions'),
      query('SELECT status, COUNT(*) as c FROM telemedicine_sessions GROUP BY status'),
      query('SELECT ROUND(AVG(duration_minutes),1) as avg FROM telemedicine_sessions WHERE duration_minutes IS NOT NULL'),
      query(`SELECT COUNT(*) as c FROM telemedicine_sessions WHERE date(scheduled_at)=date('now')`),
    ]);
    const by_status = {};
    (byStatus.rows||[]).forEach(r => { by_status[r.status] = r.c; });
    res.json({
      total:        total.rows[0]?.c || 0,
      today:        today.rows[0]?.c || 0,
      avg_duration: avgDuration.rows[0]?.avg || 0,
      by_status,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};