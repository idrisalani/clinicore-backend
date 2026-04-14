// ============================================
// consultationController.js
// File: backend/src/controllers/consultationController.js
// ============================================

import { query } from '../config/database.js';
import Joi from 'joi';
import {
  sendPrescriptionNotification,
  logNotification,
} from '../services/notificationService.js';

// ── Notification trigger — prescription issued ────────────────────────────────
const triggerPrescription = async (patientId, doctorId, medicationsPrescribed) => {
  if (!medicationsPrescribed) return;
  const [patRes, docRes] = await Promise.all([
    query('SELECT first_name, last_name, phone, email FROM patients WHERE patient_id = ?', [patientId]),
    query('SELECT full_name FROM users WHERE user_id = ?', [doctorId]),
  ]);
  const p = patRes.rows?.[0];
  if (!p) return;
  await sendPrescriptionNotification({
    patientName:  `${p.first_name} ${p.last_name}`,
    patientPhone: p.phone,
    patientEmail: p.email,
    medications:  medicationsPrescribed,
    doctorName:   docRes.rows?.[0]?.full_name || 'your doctor',
  });
  await logNotification(query, {
    patient_id:   patientId,
    type:         'prescription',
    channel:      p.phone && p.email ? 'both' : p.phone ? 'sms' : 'email',
    recipient:    p.phone || p.email,
    body:         `Prescription issued: ${medicationsPrescribed.slice(0, 80)}`,
    status:       'sent',
    reference_id: String(patientId),
  });
};

// ── Validation Schema ─────────────────────────────────────────────────────────

const consultationSchema = Joi.object({
  appointment_id:             Joi.number().integer().optional().allow(null, ''),
  patient_id:                 Joi.number().integer().required().messages({
    'number.base':  'Patient ID must be a number',
    'any.required': 'Patient is required',
  }),
  doctor_id:                  Joi.number().integer().optional().allow(null, ''),
  consultation_date:          Joi.string().optional().allow(null, ''),  // keep as string — SQLite TEXT
  chief_complaint:            Joi.string().trim().required().messages({
    'string.empty': 'Chief complaint is required',
    'any.required': 'Chief complaint is required',
  }),
  history_of_present_illness: Joi.string().trim().optional().allow(null, ''),
  past_medical_history:       Joi.string().trim().optional().allow(null, ''),
  medications:                Joi.string().trim().optional().allow(null, ''),
  allergies:                  Joi.string().trim().optional().allow(null, ''),
  vital_signs_bp:             Joi.string().trim().optional().allow(null, ''),
  vital_signs_temp:           Joi.string().trim().optional().allow(null, ''),
  vital_signs_pulse:          Joi.string().trim().optional().allow(null, ''),
  vital_signs_respiration:    Joi.string().trim().optional().allow(null, ''),
  physical_examination:       Joi.string().trim().optional().allow(null, ''),
  diagnosis:                  Joi.string().trim().required().messages({
    'string.empty': 'Diagnosis is required',
    'any.required': 'Diagnosis is required',
  }),
  diagnosis_icd:              Joi.string().trim().optional().allow(null, ''),
  treatment_plan:             Joi.string().trim().required().messages({
    'string.empty': 'Treatment plan is required',
    'any.required': 'Treatment plan is required',
  }),
  medications_prescribed:     Joi.string().trim().optional().allow(null, ''),
  procedures:                 Joi.string().trim().optional().allow(null, ''),
  follow_up_date:             Joi.string().optional().allow(null, ''),  // keep as string
  follow_up_notes:            Joi.string().trim().optional().allow(null, ''),
  referral_needed:            Joi.number().integer().optional().default(0),
  referral_to:                Joi.string().trim().optional().allow(null, ''),
  notes:                      Joi.string().trim().optional().allow(null, ''),
  status:                     Joi.string().valid('Draft', 'Completed', 'Signed', 'Reviewed').optional().default('Draft'),
}).options({ stripUnknown: true, convert: true });

// ── Helper: empty string → null for DB ───────────────────────────────────────
const n = (v) => (v === '' || v === undefined) ? null : v;

// ── GET /consultations — All with Pagination ──────────────────────────────────
export const getAllConsultations = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];
    if (patient_id) { whereClause += ' AND c.patient_id = ?'; params.push(patient_id); }
    if (status)     { whereClause += ' AND c.status = ?';     params.push(status); }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM consultations c ${whereClause}`, params
    );
    const total = countResult.rows[0]?.total || 0;

    const consultationsResult = await query(
      `SELECT c.*, p.first_name, p.last_name, p.phone
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       ${whereClause}
       ORDER BY c.consultation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      consultations: consultationsResult.rows || [],
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

// ── GET /consultations/:id ────────────────────────────────────────────────────
export const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*, p.first_name, p.last_name, p.email, p.phone, p.blood_type, p.allergies
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       WHERE c.consultation_id = ?`,
      [id]
    );

    if (!result.rows?.length) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    res.json({ consultation: result.rows[0] });
  } catch (error) {
    console.error('❌ Error getting consultation:', error);
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
};

// ── GET /consultations/patient/:patientId ─────────────────────────────────────
export const getPatientConsultations = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    const result = await query(
      `SELECT c.*, p.first_name, p.last_name
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       WHERE c.patient_id = ?
       ORDER BY c.consultation_date DESC
       LIMIT ?`,
      [patientId, limit]
    );

    res.json({ consultations: result.rows || [] });
  } catch (error) {
    console.error('❌ Error getting patient consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

// ── POST /consultations — Create ──────────────────────────────────────────────
export const createConsultation = async (req, res) => {
  try {
    const { error, value } = consultationSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      appointment_id, patient_id, doctor_id, consultation_date,
      chief_complaint, history_of_present_illness, past_medical_history,
      medications, allergies,
      vital_signs_bp, vital_signs_temp, vital_signs_pulse, vital_signs_respiration,
      physical_examination, diagnosis, diagnosis_icd, treatment_plan,
      medications_prescribed, procedures,
      follow_up_date, follow_up_notes, referral_needed, referral_to,
      notes, status,
    } = value;

    const result = await query(
      `INSERT INTO consultations (
        appointment_id, patient_id, doctor_id, consultation_date,
        chief_complaint, history_of_present_illness, past_medical_history,
        medications, allergies, vital_signs_bp, vital_signs_temp,
        vital_signs_pulse, vital_signs_respiration, physical_examination,
        diagnosis, diagnosis_icd, treatment_plan, medications_prescribed,
        procedures, follow_up_date, follow_up_notes, referral_needed,
        referral_to, notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        n(appointment_id),
        patient_id,
        n(doctor_id),
        consultation_date || new Date().toISOString().split('T')[0],
        chief_complaint,
        n(history_of_present_illness),
        n(past_medical_history),
        n(medications),
        n(allergies),
        n(vital_signs_bp),
        n(vital_signs_temp),
        n(vital_signs_pulse),
        n(vital_signs_respiration),
        n(physical_examination),
        diagnosis,
        n(diagnosis_icd),
        treatment_plan,
        n(medications_prescribed),
        n(procedures),
        n(follow_up_date),
        n(follow_up_notes),
        referral_needed ?? 0,
        n(referral_to),
        n(notes),
        status || 'Draft',
        req.user.user_id,
      ]
    );

    console.log(`✅ Consultation created: ID ${result.lastID}`);
    res.status(201).json({
      message: 'Consultation created successfully',
      consultation_id: result.lastID,
    });

    // Fire-and-forget — never blocks the response
    triggerPrescription(patient_id, doctor_id || req.user.user_id, medications_prescribed)
      .catch(e => console.warn('Prescription notification failed (non-critical):', e.message));
  } catch (error) {
    console.error('❌ Error creating consultation:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
};

// ── PUT /consultations/:id — Update ──────────────────────────────────────────
export const updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = consultationSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const existing = await query(
      'SELECT consultation_id FROM consultations WHERE consultation_id = ?', [id]
    );
    if (!existing.rows?.length) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const {
      appointment_id, patient_id, doctor_id, consultation_date,
      chief_complaint, history_of_present_illness, past_medical_history,
      medications, allergies,
      vital_signs_bp, vital_signs_temp, vital_signs_pulse, vital_signs_respiration,
      physical_examination, diagnosis, diagnosis_icd, treatment_plan,
      medications_prescribed, procedures,
      follow_up_date, follow_up_notes, referral_needed, referral_to,
      notes, status,
    } = value;

    await query(
      `UPDATE consultations SET
        appointment_id = ?, patient_id = ?, doctor_id = ?,
        consultation_date = ?, chief_complaint = ?,
        history_of_present_illness = ?, past_medical_history = ?,
        medications = ?, allergies = ?, vital_signs_bp = ?,
        vital_signs_temp = ?, vital_signs_pulse = ?,
        vital_signs_respiration = ?, physical_examination = ?,
        diagnosis = ?, diagnosis_icd = ?, treatment_plan = ?,
        medications_prescribed = ?, procedures = ?, follow_up_date = ?,
        follow_up_notes = ?, referral_needed = ?, referral_to = ?,
        notes = ?, status = ?, updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE consultation_id = ?`,
      [
        n(appointment_id),
        patient_id,
        n(doctor_id),
        consultation_date || new Date().toISOString().split('T')[0],
        chief_complaint,
        n(history_of_present_illness),
        n(past_medical_history),
        n(medications),
        n(allergies),
        n(vital_signs_bp),
        n(vital_signs_temp),
        n(vital_signs_pulse),
        n(vital_signs_respiration),
        n(physical_examination),
        diagnosis,
        n(diagnosis_icd),
        treatment_plan,
        n(medications_prescribed),
        n(procedures),
        n(follow_up_date),
        n(follow_up_notes),
        referral_needed ?? 0,
        n(referral_to),
        n(notes),
        status || 'Draft',
        req.user.user_id,
        id,
      ]
    );

    console.log(`✅ Consultation updated: ${id}`);
    res.json({ message: 'Consultation updated successfully', consultation_id: id });
  } catch (error) {
    console.error('❌ Error updating consultation:', error);
    res.status(500).json({ error: 'Failed to update consultation' });
  }
};

// ── DELETE /consultations/:id ─────────────────────────────────────────────────
export const deleteConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM consultations WHERE consultation_id = ?`, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    console.log(`✅ Consultation deleted: ${id}`);
    res.json({ message: 'Consultation deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting consultation:', error);
    res.status(500).json({ error: 'Failed to delete consultation' });
  }
};

// ── GET /consultations/stats/overview ────────────────────────────────────────
export const getConsultationStats = async (req, res) => {
  try {
    const [totalRes, statusRes, referralRes, monthRes] = await Promise.all([
      query('SELECT COUNT(*) as total FROM consultations'),
      query('SELECT status, COUNT(*) as count FROM consultations GROUP BY status'),
      query('SELECT COUNT(*) as total FROM consultations WHERE referral_needed = 1'),
      query(`SELECT COUNT(*) as total FROM consultations WHERE strftime('%Y-%m', consultation_date) = strftime('%Y-%m', 'now')`),
    ]);

    const by_status = {};
    statusRes.rows?.forEach(r => { by_status[r.status] = r.count; });

    res.json({
      total:            totalRes.rows[0]?.total   || 0,
      by_status,
      referrals_needed: referralRes.rows[0]?.total || 0,
      this_month:       monthRes.rows[0]?.total    || 0,
    });
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};