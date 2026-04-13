// ============================================
// maternityController.js
// File: backend/src/controllers/maternityController.js
// ============================================

import { query } from '../config/database.js';

const getOne = async (sql, params = []) => (await query(sql, params)).rows?.[0] || null;
const getAll = async (sql, params = []) => (await query(sql, params)).rows || [];

// ── Helper: calculate EDD from LMP ───────────────────────────────────────────
const calcEDD = (lmpDate) => {
  if (!lmpDate) return null;
  const d = new Date(lmpDate);
  d.setDate(d.getDate() + 280);
  return d.toISOString().split('T')[0];
};

// ── Helper: gestational age in weeks from LMP ─────────────────────────────────
const gestationalWeeks = (lmpDate) => {
  if (!lmpDate) return null;
  return Math.floor((Date.now() - new Date(lmpDate)) / (7 * 24 * 60 * 60 * 1000));
};

// ============================================================
// MATERNITY CASES
// ============================================================

// GET /maternity — all active cases with patient info
export const getAllCases = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', risk_level = '', search = '' } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];

    if (status)     { where.push('mc.status = ?');     params.push(status);     }
    if (risk_level) { where.push('mc.risk_level = ?'); params.push(risk_level); }
    if (search) {
      where.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const total = await getOne(
      `SELECT COUNT(*) AS n FROM maternity_cases mc
       JOIN patients p ON mc.patient_id = p.patient_id ${whereClause}`,
      params
    );

    const cases = await getAll(
      `SELECT mc.*,
         p.first_name, p.last_name, p.phone, p.date_of_birth,
         u.full_name AS created_by_name,
         (SELECT COUNT(*) FROM anc_visits WHERE case_id = mc.case_id) AS visit_count,
         (SELECT COUNT(*) FROM delivery_records WHERE case_id = mc.case_id) AS has_delivery
       FROM maternity_cases mc
       JOIN patients p ON mc.patient_id = p.patient_id
       LEFT JOIN users u ON mc.created_by = u.user_id
       ${whereClause}
       ORDER BY mc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      cases,
      pagination: {
        total: total?.n || 0,
        page:  parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((total?.n || 0) / limit),
      },
    });
  } catch (err) {
    console.error('getAllCases error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /maternity/:id — single case with visits + delivery
export const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const maternityCase = await getOne(
      `SELECT mc.*, p.first_name, p.last_name, p.phone, p.email,
         p.date_of_birth, p.blood_type, p.allergies,
         u.full_name AS created_by_name
       FROM maternity_cases mc
       JOIN patients p ON mc.patient_id = p.patient_id
       LEFT JOIN users u ON mc.created_by = u.user_id
       WHERE mc.case_id = ?`,
      [id]
    );
    if (!maternityCase) return res.status(404).json({ error: 'Case not found' });

    const visits = await getAll(
      `SELECT av.*, u.full_name AS attended_by_name
       FROM anc_visits av
       LEFT JOIN users u ON av.attended_by = u.user_id
       WHERE av.case_id = ?
       ORDER BY av.visit_date DESC`,
      [id]
    );

    const delivery = await getOne(
      `SELECT dr.*, u.full_name AS delivered_by_name
       FROM delivery_records dr
       LEFT JOIN users u ON dr.delivered_by = u.user_id
       WHERE dr.case_id = ?`,
      [id]
    );

    res.json({ case: maternityCase, visits, delivery });
  } catch (err) {
    console.error('getCaseById error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /maternity/patient/:patientId — all cases for a patient
export const getPatientCases = async (req, res) => {
  try {
    const { patientId } = req.params;
    const cases = await getAll(
      `SELECT mc.*,
         (SELECT COUNT(*) FROM anc_visits WHERE case_id = mc.case_id) AS visit_count
       FROM maternity_cases mc
       WHERE mc.patient_id = ?
       ORDER BY mc.created_at DESC`,
      [patientId]
    );
    res.json({ cases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /maternity — open a new maternity case
export const createCase = async (req, res) => {
  try {
    const {
      patient_id, lmp_date, edd_by_scan, gestational_age_weeks,
      gravida = 1, parity = 0, previous_cs = 0,
      previous_miscarriages = 0, previous_stillbirths = 0,
      booking_date, blood_group, rhesus_factor, hiv_status, hb_at_booking,
      risk_level = 'Low', risk_factors, notes,
    } = req.body;

    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    // Check for already-active case
    const existing = await getOne(
      `SELECT case_id FROM maternity_cases
       WHERE patient_id = ? AND status = 'Active'`,
      [patient_id]
    );
    if (existing) {
      return res.status(400).json({
        error: 'Patient already has an active maternity case',
        case_id: existing.case_id,
      });
    }

    const edd = calcEDD(lmp_date);

    const result = await query(
      `INSERT INTO maternity_cases (
        patient_id, lmp_date, edd, edd_by_scan, gestational_age_weeks,
        gravida, parity, previous_cs, previous_miscarriages, previous_stillbirths,
        booking_date, blood_group, rhesus_factor, hiv_status, hb_at_booking,
        risk_level, risk_factors, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        patient_id, lmp_date || null, edd, edd_by_scan || null,
        gestational_age_weeks || gestationalWeeks(lmp_date) || null,
        gravida, parity, previous_cs, previous_miscarriages, previous_stillbirths,
        booking_date || null, blood_group || null, rhesus_factor || null,
        hiv_status || 'Unknown', hb_at_booking || null,
        risk_level, risk_factors || null, notes || null,
        req.user.user_id,
      ]
    );

    console.log(`✅ Maternity case created: ID ${result.lastID}`);
    res.status(201).json({ message: 'Maternity case created', case_id: result.lastID, edd });
  } catch (err) {
    console.error('createCase error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /maternity/:id — update case details
export const updateCase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lmp_date, edd_by_scan, risk_level, risk_factors,
      gravida, parity, previous_cs, blood_group, rhesus_factor,
      hiv_status, hb_at_booking, status, outcome, notes,
    } = req.body;

    const existing = await getOne('SELECT case_id FROM maternity_cases WHERE case_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const edd = lmp_date ? calcEDD(lmp_date) : undefined;

    await query(
      `UPDATE maternity_cases SET
        lmp_date       = COALESCE(?, lmp_date),
        edd            = COALESCE(?, edd),
        edd_by_scan    = COALESCE(?, edd_by_scan),
        risk_level     = COALESCE(?, risk_level),
        risk_factors   = COALESCE(?, risk_factors),
        gravida        = COALESCE(?, gravida),
        parity         = COALESCE(?, parity),
        previous_cs    = COALESCE(?, previous_cs),
        blood_group    = COALESCE(?, blood_group),
        rhesus_factor  = COALESCE(?, rhesus_factor),
        hiv_status     = COALESCE(?, hiv_status),
        hb_at_booking  = COALESCE(?, hb_at_booking),
        status         = COALESCE(?, status),
        outcome        = COALESCE(?, outcome),
        notes          = COALESCE(?, notes),
        updated_by     = ?,
        updated_at     = CURRENT_TIMESTAMP
       WHERE case_id = ?`,
      [
        lmp_date || null, edd || null, edd_by_scan || null,
        risk_level || null, risk_factors || null,
        gravida || null, parity || null, previous_cs || null,
        blood_group || null, rhesus_factor || null, hiv_status || null,
        hb_at_booking || null, status || null, outcome || null,
        notes || null, req.user.user_id, id,
      ]
    );

    res.json({ message: 'Case updated', case_id: id });
  } catch (err) {
    console.error('updateCase error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /maternity/stats — dashboard stats
export const getMaternityStats = async (req, res) => {
  try {
    const stats = await getOne(`
      SELECT
        COUNT(*)                                              AS total_cases,
        SUM(CASE WHEN status = 'Active'    THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN risk_level = 'High' OR risk_level = 'Very High' THEN 1 ELSE 0 END) AS high_risk,
        SUM(CASE WHEN edd BETWEEN date('now') AND date('now','+30 days') THEN 1 ELSE 0 END) AS due_soon
      FROM maternity_cases
    `);

    const deliveryStats = await getOne(`
      SELECT
        COUNT(*)                                                       AS total_deliveries,
        SUM(CASE WHEN mode_of_delivery LIKE '%CS%' THEN 1 ELSE 0 END) AS cs_count,
        SUM(CASE WHEN outcome = 'Live Birth'        THEN 1 ELSE 0 END) AS live_births,
        SUM(CASE WHEN outcome = 'Stillbirth'        THEN 1 ELSE 0 END) AS stillbirths,
        ROUND(AVG(birth_weight_kg), 2)                                 AS avg_birth_weight
      FROM delivery_records
    `);

    res.json({ ...stats, ...deliveryStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ANC VISITS
// ============================================================

// POST /maternity/:id/visits — record ANC visit
export const addANCVisit = async (req, res) => {
  try {
    const { id: case_id } = req.params;

    const maternityCase = await getOne(
      'SELECT patient_id, status FROM maternity_cases WHERE case_id = ?', [case_id]
    );
    if (!maternityCase) return res.status(404).json({ error: 'Case not found' });
    if (maternityCase.status !== 'Active') {
      return res.status(400).json({ error: 'Cannot add visit to a closed case' });
    }

    const {
      visit_date, gestational_week, visit_type = 'Routine',
      weight_kg, bp_systolic, bp_diastolic, temperature_c, pulse_bpm, haemoglobin,
      fundal_height_cm, fetal_presentation, fetal_heart_rate, fetal_movement,
      lie, engagement, urine_protein, urine_glucose, oedema,
      tt_vaccine = 0, tt_dose_number, ipt_given = 0,
      iron_folic_given = 0, llin_given = 0,
      complaints, clinical_notes, next_visit_date,
    } = req.body;

    if (!visit_date) return res.status(400).json({ error: 'visit_date is required' });

    const result = await query(
      `INSERT INTO anc_visits (
        case_id, patient_id, visit_date, gestational_week, visit_type,
        weight_kg, bp_systolic, bp_diastolic, temperature_c, pulse_bpm, haemoglobin,
        fundal_height_cm, fetal_presentation, fetal_heart_rate, fetal_movement,
        lie, engagement, urine_protein, urine_glucose, oedema,
        tt_vaccine, tt_dose_number, ipt_given, iron_folic_given, llin_given,
        complaints, clinical_notes, next_visit_date, attended_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        case_id, maternityCase.patient_id, visit_date, gestational_week || null,
        visit_type, weight_kg || null, bp_systolic || null, bp_diastolic || null,
        temperature_c || null, pulse_bpm || null, haemoglobin || null,
        fundal_height_cm || null, fetal_presentation || null,
        fetal_heart_rate || null, fetal_movement || null,
        lie || null, engagement || null, urine_protein || null,
        urine_glucose || null, oedema || null,
        tt_vaccine ? 1 : 0, tt_dose_number || null,
        ipt_given ? 1 : 0, iron_folic_given ? 1 : 0, llin_given ? 1 : 0,
        complaints || null, clinical_notes || null, next_visit_date || null,
        req.user.user_id,
      ]
    );

    // Increment ANC count on the case
    await query(
      'UPDATE maternity_cases SET anc_count = anc_count + 1, updated_at = CURRENT_TIMESTAMP WHERE case_id = ?',
      [case_id]
    );

    res.status(201).json({ message: 'ANC visit recorded', visit_id: result.lastID });
  } catch (err) {
    console.error('addANCVisit error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /maternity/visits/:visitId — update a visit
export const updateANCVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const visit = await getOne('SELECT visit_id FROM anc_visits WHERE visit_id = ?', [visitId]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    const fields = [
      'visit_date','gestational_week','visit_type','weight_kg','bp_systolic',
      'bp_diastolic','temperature_c','pulse_bpm','haemoglobin','fundal_height_cm',
      'fetal_presentation','fetal_heart_rate','fetal_movement','lie','engagement',
      'urine_protein','urine_glucose','oedema','tt_vaccine','tt_dose_number',
      'ipt_given','iron_folic_given','llin_given','complaints','clinical_notes',
      'next_visit_date',
    ];

    const setClauses = fields.map(f => `${f} = COALESCE(?, ${f})`).join(', ');
    const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : null);

    await query(`UPDATE anc_visits SET ${setClauses} WHERE visit_id = ?`, [...values, visitId]);
    res.json({ message: 'Visit updated', visit_id: visitId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELIVERY RECORDS
// ============================================================

// POST /maternity/:id/delivery — record delivery
export const recordDelivery = async (req, res) => {
  try {
    const { id: case_id } = req.params;

    const maternityCase = await getOne(
      'SELECT patient_id, status FROM maternity_cases WHERE case_id = ?', [case_id]
    );
    if (!maternityCase) return res.status(404).json({ error: 'Case not found' });

    const existingDelivery = await getOne(
      'SELECT delivery_id FROM delivery_records WHERE case_id = ?', [case_id]
    );
    if (existingDelivery) {
      return res.status(400).json({ error: 'Delivery already recorded for this case' });
    }

    const {
      delivery_date, delivery_time, gestational_age_at_delivery,
      mode_of_delivery = 'SVD', outcome = 'Live Birth',
      complications, blood_loss_ml,
      newborn_sex, birth_weight_kg, apgar_1min, apgar_5min, apgar_10min,
      resuscitation_needed = 0, nicu_admission = 0, newborn_notes,
      placenta_complete = 1, episiotomy = 0, blood_transfusion = 0,
      maternal_condition = 'Stable', discharge_date, postnatal_notes,
      delivered_by,
    } = req.body;

    if (!delivery_date) return res.status(400).json({ error: 'delivery_date is required' });
    if (!mode_of_delivery) return res.status(400).json({ error: 'mode_of_delivery is required' });

    const result = await query(
      `INSERT INTO delivery_records (
        case_id, patient_id, delivery_date, delivery_time,
        gestational_age_at_delivery, mode_of_delivery, outcome,
        complications, blood_loss_ml, newborn_sex, birth_weight_kg,
        apgar_1min, apgar_5min, apgar_10min, resuscitation_needed,
        nicu_admission, newborn_notes, placenta_complete, episiotomy,
        blood_transfusion, maternal_condition, discharge_date,
        postnatal_notes, delivered_by, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        case_id, maternityCase.patient_id, delivery_date, delivery_time || null,
        gestational_age_at_delivery || null, mode_of_delivery, outcome,
        complications || null, blood_loss_ml || null,
        newborn_sex || null, birth_weight_kg || null,
        apgar_1min || null, apgar_5min || null, apgar_10min || null,
        resuscitation_needed ? 1 : 0, nicu_admission ? 1 : 0,
        newborn_notes || null, placenta_complete ? 1 : 0,
        episiotomy ? 1 : 0, blood_transfusion ? 1 : 0,
        maternal_condition, discharge_date || null,
        postnatal_notes || null,
        delivered_by || req.user.user_id, req.user.user_id,
      ]
    );

    await query(
      `UPDATE maternity_cases SET
         status = 'Delivered', outcome = ?, updated_by = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE case_id = ?`,
      [outcome, req.user.user_id, case_id]
    );

    res.status(201).json({ message: 'Delivery recorded', delivery_id: result.lastID });
  } catch (err) {
    console.error('recordDelivery error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /maternity/delivery/:deliveryId — update delivery record
export const updateDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await getOne(
      'SELECT delivery_id FROM delivery_records WHERE delivery_id = ?', [deliveryId]
    );
    if (!delivery) return res.status(404).json({ error: 'Delivery record not found' });

    const {
      delivery_date, delivery_time, mode_of_delivery, outcome, complications,
      blood_loss_ml, newborn_sex, birth_weight_kg, apgar_1min, apgar_5min,
      apgar_10min, resuscitation_needed, nicu_admission, newborn_notes,
      placenta_complete, episiotomy, blood_transfusion, maternal_condition,
      discharge_date, postnatal_notes,
    } = req.body;

    await query(
      `UPDATE delivery_records SET
        delivery_date        = COALESCE(?, delivery_date),
        delivery_time        = COALESCE(?, delivery_time),
        mode_of_delivery     = COALESCE(?, mode_of_delivery),
        outcome              = COALESCE(?, outcome),
        complications        = COALESCE(?, complications),
        blood_loss_ml        = COALESCE(?, blood_loss_ml),
        newborn_sex          = COALESCE(?, newborn_sex),
        birth_weight_kg      = COALESCE(?, birth_weight_kg),
        apgar_1min           = COALESCE(?, apgar_1min),
        apgar_5min           = COALESCE(?, apgar_5min),
        apgar_10min          = COALESCE(?, apgar_10min),
        resuscitation_needed = COALESCE(?, resuscitation_needed),
        nicu_admission       = COALESCE(?, nicu_admission),
        newborn_notes        = COALESCE(?, newborn_notes),
        placenta_complete    = COALESCE(?, placenta_complete),
        episiotomy           = COALESCE(?, episiotomy),
        blood_transfusion    = COALESCE(?, blood_transfusion),
        maternal_condition   = COALESCE(?, maternal_condition),
        discharge_date       = COALESCE(?, discharge_date),
        postnatal_notes      = COALESCE(?, postnatal_notes),
        updated_at           = CURRENT_TIMESTAMP
       WHERE delivery_id = ?`,
      [
        delivery_date || null, delivery_time || null, mode_of_delivery || null,
        outcome || null, complications || null, blood_loss_ml || null,
        newborn_sex || null, birth_weight_kg || null,
        apgar_1min || null, apgar_5min || null, apgar_10min || null,
        resuscitation_needed !== undefined ? (resuscitation_needed ? 1 : 0) : null,
        nicu_admission !== undefined ? (nicu_admission ? 1 : 0) : null,
        newborn_notes || null,
        placenta_complete !== undefined ? (placenta_complete ? 1 : 0) : null,
        episiotomy !== undefined ? (episiotomy ? 1 : 0) : null,
        blood_transfusion !== undefined ? (blood_transfusion ? 1 : 0) : null,
        maternal_condition || null, discharge_date || null,
        postnatal_notes || null, deliveryId,
      ]
    );

    res.json({ message: 'Delivery record updated', delivery_id: deliveryId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};