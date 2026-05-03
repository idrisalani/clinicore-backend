// ============================================
// visitController.js
// File: backend/src/controllers/visitController.js
// Mount: app.use('/api/v1/visits', visitRoutes)
// ============================================
import { query } from '../config/database.js';
import { decryptFields, decryptRows, PHI_FIELDS } from '../utils/encryption.js';

const n      = (v) => (v === '' || v === undefined) ? null : v;
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

const PATIENT_PHI = PHI_FIELDS.patients;

// Valid status transitions — enforces clinical workflow order
const VALID_TRANSITIONS = {
  'Registered':         ['Waiting', 'Cancelled'],
  'Waiting':            ['With Nurse', 'Cancelled'],
  'With Nurse':         ['With Doctor', 'Cancelled'],
  'With Doctor':        ['Awaiting Lab', 'Awaiting Imaging', 'Awaiting Pharmacy', 'Admitted', 'Discharged'],
  'Awaiting Lab':       ['With Doctor', 'Awaiting Pharmacy', 'Discharged'],
  'Awaiting Imaging':   ['With Doctor', 'Awaiting Pharmacy', 'Discharged'],
  'Awaiting Pharmacy':  ['Discharged', 'Admitted'],
  'Admitted':           ['Discharged'],
  'Discharged':         [],
  'Cancelled':          [],
};

// ── POST /visits — receptionist creates visit on check-in ─────────────────────
export const createVisit = async (req, res) => {
  try {
    const {
      patient_id, visit_type = 'Outpatient',
      chief_complaint, triage_priority = 'Normal',
      appointment_id,
    } = req.body;

    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    const patient = await getOne(
      'SELECT patient_id FROM patients WHERE patient_id = ? AND is_active = 1',
      [patient_id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const result = await query(
      `INSERT INTO visits
        (patient_id, visit_type, status, chief_complaint, triage_priority,
         registered_by, appointment_id, facility_id, created_at, updated_at)
       VALUES (?, ?, 'Registered', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        patient_id, visit_type, n(chief_complaint), triage_priority,
        req.user.user_id, n(appointment_id), req.facilityId,
      ]
    );

    // Log initial status
    await query(
      `INSERT INTO visit_status_log (visit_id, from_status, to_status, changed_by)
       VALUES (?, NULL, 'Registered', ?)`,
      [result.lastID, req.user.user_id]
    );

    console.log(`✅ Visit created: #${result.lastID} for patient ${patient_id}`);
    res.status(201).json({
      message:  'Visit created',
      visit_id: result.lastID,
    });
  } catch (err) {
    console.error('createVisit error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /visits — list today's visits for the queue dashboard ─────────────────
export const getTodaysVisits = async (req, res) => {
  try {
    const { status, doctor_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let where = [`DATE(v.visit_date) = ?`, `v.facility_id = ?`];
    const params = [targetDate, req.facilityId];

    if (status)    { where.push('v.status = ?');    params.push(status); }
    if (doctor_id) { where.push('v.doctor_id = ?'); params.push(doctor_id); }

    const rows = await getAll(
      `SELECT
         v.*,
         p.first_name, p.last_name, p.phone, p.email,
         p.blood_type, p.allergies,
         u_reg.full_name  AS registered_by_name,
         u_nur.full_name  AS nurse_name,
         u_doc.full_name  AS doctor_name,
         vt.temperature, vt.blood_pressure_sys, vt.blood_pressure_dia,
         vt.pulse_rate, vt.oxygen_saturation, vt.weight,
         ROUND((julianday('now') - julianday(v.visit_date)) * 24 * 60) AS wait_minutes
       FROM visits v
       JOIN patients p ON v.patient_id = p.patient_id
       LEFT JOIN users u_reg ON v.registered_by = u_reg.user_id
       LEFT JOIN users u_nur ON v.nurse_id       = u_nur.user_id
       LEFT JOIN users u_doc ON v.doctor_id      = u_doc.user_id
       LEFT JOIN vitals vt   ON vt.visit_id = v.visit_id
       WHERE ${where.join(' AND ')}
       ORDER BY
         CASE v.triage_priority
           WHEN 'Emergency' THEN 1
           WHEN 'Urgent'    THEN 2
           ELSE 3
         END,
         v.visit_date ASC`,
      params
    );

    // Decrypt patient PHI
    const decrypted = decryptRows(rows, PATIENT_PHI);

    // Stats summary
    const stats = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    res.json({ visits: decrypted, stats, date: targetDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /visits/:id — single visit with full context ─────────────────────────
export const getVisitById = async (req, res) => {
  try {
    const visit = await getOne(
      `SELECT v.*,
         p.first_name, p.last_name, p.phone, p.email,
         p.date_of_birth, p.blood_type, p.allergies, p.chronic_conditions,
         u_doc.full_name AS doctor_name
       FROM visits v
       JOIN patients p     ON v.patient_id  = p.patient_id
       LEFT JOIN users u_doc ON v.doctor_id = u_doc.user_id
       WHERE v.visit_id = ?`,
      [req.params.id]
    );
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    // Decrypt patient PHI
    const decryptedVisit = decryptFields(visit, PATIENT_PHI);

    // Attach vitals if recorded
    const vitals = await getOne(
      'SELECT * FROM vitals WHERE visit_id = ? ORDER BY recorded_at DESC LIMIT 1',
      [req.params.id]
    );

    // Status history
    const statusLog = await getAll(
      `SELECT vsl.*, u.full_name AS changed_by_name
       FROM visit_status_log vsl
       LEFT JOIN users u ON vsl.changed_by = u.user_id
       WHERE vsl.visit_id = ?
       ORDER BY vsl.changed_at ASC`,
      [req.params.id]
    );

    res.json({ visit: decryptedVisit, vitals, status_log: statusLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /visits/:id/status — advance the visit through the workflow ───────────
export const updateVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, doctor_id, nurse_id, discharge_summary, discharge_type, follow_up_date } = req.body;

    const visit = await getOne('SELECT * FROM visits WHERE visit_id = ?', [id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    // Validate transition
    const allowed = VALID_TRANSITIONS[visit.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error:    `Cannot transition from "${visit.status}" to "${status}"`,
        allowed,
      });
    }

    // Build update
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params  = [status];

    if (nurse_id)         { updates.push('nurse_id = ?');          params.push(nurse_id); }
    if (doctor_id)        { updates.push('doctor_id = ?');         params.push(doctor_id); }
    if (discharge_summary){ updates.push('discharge_summary = ?'); params.push(discharge_summary); }
    if (discharge_type)   { updates.push('discharge_type = ?');    params.push(discharge_type); }
    if (follow_up_date)   { updates.push('follow_up_date = ?');    params.push(follow_up_date); }
    if (status === 'Discharged') {
      updates.push('discharge_date = CURRENT_TIMESTAMP');
    }

    params.push(id);
    await query(`UPDATE visits SET ${updates.join(', ')} WHERE visit_id = ?`, params);

    // Log the transition
    await query(
      `INSERT INTO visit_status_log (visit_id, from_status, to_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, visit.status, status, req.user.user_id, n(notes)]
    );

    res.json({ message: `Visit status updated to "${status}"`, visit_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /visits/patient/:patientId — all visits for a patient (timeline) ──────
export const getPatientVisits = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 20 } = req.query;

    const visits = await getAll(
      `SELECT v.*,
         u_doc.full_name AS doctor_name,
         u_nur.full_name AS nurse_name,
         vt.temperature, vt.blood_pressure_sys, vt.blood_pressure_dia,
         vt.pulse_rate,  vt.oxygen_saturation,  vt.weight
       FROM visits v
       LEFT JOIN users u_doc ON v.doctor_id = u_doc.user_id
       LEFT JOIN users u_nur ON v.nurse_id  = u_nur.user_id
       LEFT JOIN vitals vt   ON vt.visit_id = v.visit_id
       WHERE v.patient_id = ? AND v.facility_id = ?
       ORDER BY v.visit_date DESC
       LIMIT ?`,
      [patientId, req.facilityId, limit]
    );

    res.json({ visits, total: visits.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /patients/:id/timeline — full clinical history for doctor view ────────
export const getPatientTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getOne(
      'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Use the patient_timeline view
    const timeline = await getAll(
      `SELECT * FROM patient_timeline WHERE patient_id = ? ORDER BY event_date DESC`,
      [id]
    );

    // Summary counts
    const summary = timeline.reduce((acc, r) => {
      acc[r.record_type] = (acc[r.record_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      patient:  decryptFields(patient, PATIENT_PHI),
      timeline,
      summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};