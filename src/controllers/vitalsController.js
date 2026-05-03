// ============================================
// vitalsController.js
// File: backend/src/controllers/vitalsController.js
// Mount: app.use('/api/v1/vitals', vitalsRoutes)
// ============================================
import { query } from '../config/database.js';

const n      = (v) => (v === '' || v === undefined) ? null : v;
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── POST /vitals — nurse records vital signs ──────────────────────────────────
export const recordVitals = async (req, res) => {
  try {
    const {
      visit_id, patient_id,
      blood_pressure_sys, blood_pressure_dia,
      pulse_rate, temperature, respiratory_rate,
      oxygen_saturation, weight, height,
      blood_glucose, pain_score,
      general_appearance, notes,
    } = req.body;

    if (!visit_id || !patient_id) {
      return res.status(400).json({ error: 'visit_id and patient_id are required' });
    }

    // Verify visit exists and is in correct state for vitals
    const visit = await getOne('SELECT * FROM visits WHERE visit_id = ?', [visit_id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    // Auto-compute BMI if weight and height provided
    let bmi = null;
    if (weight && height && height > 0) {
      const heightM = height / 100;
      bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));
    }

    const result = await query(
      `INSERT INTO vitals (
        visit_id, patient_id,
        blood_pressure_sys, blood_pressure_dia,
        pulse_rate, temperature, respiratory_rate,
        oxygen_saturation, weight, height, bmi,
        blood_glucose, pain_score,
        general_appearance, notes,
        recorded_by, recorded_at, facility_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        visit_id, patient_id,
        n(blood_pressure_sys), n(blood_pressure_dia),
        n(pulse_rate), n(temperature), n(respiratory_rate),
        n(oxygen_saturation), n(weight), n(height), bmi,
        n(blood_glucose), n(pain_score),
        n(general_appearance), n(notes),
        req.user.user_id, req.facilityId,
      ]
    );

    // Auto-advance visit status to "With Doctor" if still "With Nurse"
    if (visit.status === 'With Nurse') {
      await query(
        `UPDATE visits SET status = 'With Doctor',
         nurse_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE visit_id = ?`,
        [req.user.user_id, visit_id]
      );
      await query(
        `INSERT INTO visit_status_log (visit_id, from_status, to_status, changed_by, notes)
         VALUES (?, 'With Nurse', 'With Doctor', ?, 'Vitals recorded — referred to doctor')`,
        [visit_id, req.user.user_id]
      );
    }

    res.status(201).json({
      message:  'Vitals recorded',
      vital_id: result.lastID,
      bmi,
    });
  } catch (err) {
    console.error('recordVitals error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /vitals/visit/:visitId — vitals for a specific visit ──────────────────
export const getVitalsByVisit = async (req, res) => {
  try {
    const vitals = await getAll(
      `SELECT vt.*, u.full_name AS recorded_by_name
       FROM vitals vt
       LEFT JOIN users u ON vt.recorded_by = u.user_id
       WHERE vt.visit_id = ?
       ORDER BY vt.recorded_at DESC`,
      [req.params.visitId]
    );
    res.json({ vitals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /vitals/patient/:patientId — vitals history for a patient ─────────────
export const getVitalsByPatient = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const vitals = await getAll(
      `SELECT vt.*, v.visit_date, v.visit_type, u.full_name AS recorded_by_name
       FROM vitals vt
       JOIN visits v   ON vt.visit_id = v.visit_id
       LEFT JOIN users u ON vt.recorded_by = u.user_id
       WHERE vt.patient_id = ?
       ORDER BY vt.recorded_at DESC
       LIMIT ?`,
      [req.params.patientId, limit]
    );

    // Compute trends (last 5 readings)
    const trends = vitals.slice(0, 5).map(v => ({
      date:    v.recorded_at,
      bp:      v.blood_pressure_sys && v.blood_pressure_dia
                 ? `${v.blood_pressure_sys}/${v.blood_pressure_dia}` : null,
      pulse:   v.pulse_rate,
      temp:    v.temperature,
      spo2:    v.oxygen_saturation,
      weight:  v.weight,
    }));

    res.json({ vitals, trends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /vitals/:id — update/amend vitals (nurse correction) ─────────────────
export const updateVitals = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT * FROM vitals WHERE vital_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Vitals record not found' });

    const {
      blood_pressure_sys, blood_pressure_dia, pulse_rate,
      temperature, respiratory_rate, oxygen_saturation,
      weight, height, blood_glucose, pain_score,
      general_appearance, notes,
    } = req.body;

    let bmi = existing.bmi;
    const w = weight || existing.weight;
    const h = height || existing.height;
    if (w && h && h > 0) {
      const hm = h / 100;
      bmi = parseFloat((w / (hm * hm)).toFixed(1));
    }

    await query(
      `UPDATE vitals SET
        blood_pressure_sys  = COALESCE(?, blood_pressure_sys),
        blood_pressure_dia  = COALESCE(?, blood_pressure_dia),
        pulse_rate          = COALESCE(?, pulse_rate),
        temperature         = COALESCE(?, temperature),
        respiratory_rate    = COALESCE(?, respiratory_rate),
        oxygen_saturation   = COALESCE(?, oxygen_saturation),
        weight              = COALESCE(?, weight),
        height              = COALESCE(?, height),
        bmi                 = ?,
        blood_glucose       = COALESCE(?, blood_glucose),
        pain_score          = COALESCE(?, pain_score),
        general_appearance  = COALESCE(?, general_appearance),
        notes               = COALESCE(?, notes)
       WHERE vital_id = ?`,
      [
        n(blood_pressure_sys), n(blood_pressure_dia), n(pulse_rate),
        n(temperature), n(respiratory_rate), n(oxygen_saturation),
        n(weight), n(height), bmi,
        n(blood_glucose), n(pain_score),
        n(general_appearance), n(notes), id,
      ]
    );
    res.json({ message: 'Vitals updated', bmi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};