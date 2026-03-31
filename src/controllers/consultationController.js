import { query } from '../config/database.js';
import Joi from 'joi';

// ==========================================
// Validation Schemas
// ==========================================

const consultationSchema = Joi.object({
  appointment_id: Joi.number().optional(),
  patient_id: Joi.number().required().messages({
    'number.base': 'Patient ID is required',
  }),
  doctor_id: Joi.number().optional(),
  consultation_date: Joi.date().required().messages({
    'date.base': 'Consultation date is required',
  }),
  chief_complaint: Joi.string().required().messages({
    'string.empty': 'Chief complaint is required',
  }),
  history_of_present_illness: Joi.string().optional(),
  past_medical_history: Joi.string().optional(),
  medications: Joi.string().optional(),
  allergies: Joi.string().optional(),
  vital_signs_bp: Joi.string().optional(),
  vital_signs_temp: Joi.string().optional(),
  vital_signs_pulse: Joi.string().optional(),
  vital_signs_respiration: Joi.string().optional(),
  physical_examination: Joi.string().optional(),
  diagnosis: Joi.string().required().messages({
    'string.empty': 'Diagnosis is required',
  }),
  diagnosis_icd: Joi.string().optional(),
  treatment_plan: Joi.string().required().messages({
    'string.empty': 'Treatment plan is required',
  }),
  medications_prescribed: Joi.string().optional(),
  procedures: Joi.string().optional(),
  follow_up_date: Joi.date().optional(),
  follow_up_notes: Joi.string().optional(),
  referral_needed: Joi.number().optional().default(0),
  referral_to: Joi.string().optional(),
  notes: Joi.string().optional(),
  status: Joi.string().valid('Draft', 'Completed', 'Signed', 'Reviewed').optional(),
});

// ==========================================
// Get All Consultations with Pagination
// ==========================================
export const getAllConsultations = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('📋 Getting consultations...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) {
      whereClause += ' AND c.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM consultations ${whereClause}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    // Get paginated results
    const consultationsResult = await query(
      `SELECT c.*, p.first_name, p.last_name, p.phone
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       ${whereClause}
       ORDER BY c.consultation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const consultations = consultationsResult.rows || [];

    console.log(`✅ Found ${consultations.length} consultations`);

    res.json({
      consultations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

// ==========================================
// Get Single Consultation
// ==========================================
export const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📝 Getting consultation: ${id}`);

    const result = await query(
      `SELECT c.*, p.first_name, p.last_name, p.email, p.phone, p.blood_type, p.allergies
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       WHERE c.consultation_id = ?`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    console.log('✅ Consultation found');

    res.json({ consultation: result.rows[0] });
  } catch (error) {
    console.error('❌ Error getting consultation:', error);
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
};

// ==========================================
// Get Patient Consultations
// ==========================================
export const getPatientConsultations = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    console.log(`📝 Getting consultations for patient: ${patientId}`);

    const result = await query(
      `SELECT c.*, p.first_name, p.last_name
       FROM consultations c
       JOIN patients p ON c.patient_id = p.patient_id
       WHERE c.patient_id = ?
       ORDER BY c.consultation_date DESC
       LIMIT ?`,
      [patientId, limit]
    );

    const consultations = result.rows || [];

    console.log(`✅ Found ${consultations.length} consultations`);

    res.json({ consultations });
  } catch (error) {
    console.error('❌ Error getting patient consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

// ==========================================
// Create Consultation
// ==========================================
export const createConsultation = async (req, res) => {
  try {
    const { error, value } = consultationSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating consultation...');

    const {
      appointment_id,
      patient_id,
      doctor_id,
      consultation_date,
      chief_complaint,
      history_of_present_illness,
      past_medical_history,
      medications,
      allergies,
      vital_signs_bp,
      vital_signs_temp,
      vital_signs_pulse,
      vital_signs_respiration,
      physical_examination,
      diagnosis,
      diagnosis_icd,
      treatment_plan,
      medications_prescribed,
      procedures,
      follow_up_date,
      follow_up_notes,
      referral_needed,
      referral_to,
      notes,
      status,
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
        appointment_id || null,
        patient_id,
        doctor_id || null,
        consultation_date,
        chief_complaint,
        history_of_present_illness || null,
        past_medical_history || null,
        medications || null,
        allergies || null,
        vital_signs_bp || null,
        vital_signs_temp || null,
        vital_signs_pulse || null,
        vital_signs_respiration || null,
        physical_examination || null,
        diagnosis,
        diagnosis_icd || null,
        treatment_plan,
        medications_prescribed || null,
        procedures || null,
        follow_up_date || null,
        follow_up_notes || null,
        referral_needed || 0,
        referral_to || null,
        notes || null,
        status || 'Draft',
        req.user.user_id,
      ]
    );

    console.log(`✅ Consultation created: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Consultation created successfully',
      consultation_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating consultation:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
};

// ==========================================
// Update Consultation
// ==========================================
export const updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = consultationSchema.validate(req.body);

    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✏️ Updating consultation: ${id}`);

    const existing = await query(
      'SELECT consultation_id FROM consultations WHERE consultation_id = ?',
      [id]
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const {
      appointment_id,
      patient_id,
      doctor_id,
      consultation_date,
      chief_complaint,
      history_of_present_illness,
      past_medical_history,
      medications,
      allergies,
      vital_signs_bp,
      vital_signs_temp,
      vital_signs_pulse,
      vital_signs_respiration,
      physical_examination,
      diagnosis,
      diagnosis_icd,
      treatment_plan,
      medications_prescribed,
      procedures,
      follow_up_date,
      follow_up_notes,
      referral_needed,
      referral_to,
      notes,
      status,
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
        appointment_id || null,
        patient_id,
        doctor_id || null,
        consultation_date,
        chief_complaint,
        history_of_present_illness || null,
        past_medical_history || null,
        medications || null,
        allergies || null,
        vital_signs_bp || null,
        vital_signs_temp || null,
        vital_signs_pulse || null,
        vital_signs_respiration || null,
        physical_examination || null,
        diagnosis,
        diagnosis_icd || null,
        treatment_plan,
        medications_prescribed || null,
        procedures || null,
        follow_up_date || null,
        follow_up_notes || null,
        referral_needed || 0,
        referral_to || null,
        notes || null,
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

// ==========================================
// Delete Consultation (Soft Delete)
// ==========================================
export const deleteConsultation = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting consultation: ${id}`);

    const result = await query(
      `DELETE FROM consultations WHERE consultation_id = ?`,
      [id]
    );

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

// ==========================================
// Get Consultation Statistics
// ==========================================
export const getConsultationStats = async (req, res) => {
  try {
    console.log('📊 Getting consultation statistics');

    const stats = {};

    // Total consultations
    const totalResult = await query('SELECT COUNT(*) as total FROM consultations');
    stats.total = totalResult.rows[0]?.total || 0;

    // By status
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM consultations
      GROUP BY status
    `);

    stats.by_status = {};
    statusResult.rows?.forEach(row => {
      stats.by_status[row.status] = row.count;
    });

    // Referrals needed
    const referralResult = await query(
      'SELECT COUNT(*) as total FROM consultations WHERE referral_needed = 1'
    );
    stats.referrals_needed = referralResult.rows[0]?.total || 0;

    // This month
    const monthResult = await query(
      `SELECT COUNT(*) as total FROM consultations
       WHERE strftime('%Y-%m', consultation_date) = strftime('%Y-%m', 'now')`
    );
    stats.this_month = monthResult.rows[0]?.total || 0;

    console.log('✅ Statistics retrieved:', stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};