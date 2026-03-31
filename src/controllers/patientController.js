import { query } from '../config/database.js';
import Joi from 'joi';

// ==========================================
// Validation Schemas
// ==========================================

const patientSchema = Joi.object({
  first_name: Joi.string().required().messages({
    'string.empty': 'First name is required',
  }),
  last_name: Joi.string().required().messages({
    'string.empty': 'Last name is required',
  }),
  email: Joi.string().email().optional(),
  phone: Joi.string().required().messages({
    'string.empty': 'Phone number is required',
  }),
  date_of_birth: Joi.date().required().messages({
    'date.base': 'Date of birth must be a valid date',
  }),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  zip_code: Joi.string().optional(),
  blood_type: Joi.string().valid('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown').optional(),
  allergies: Joi.string().optional(),
  chronic_conditions: Joi.string().optional(),
  insurance_provider: Joi.string().optional(),
  insurance_policy_number: Joi.string().optional(),
  insurance_group_number: Joi.string().optional(),
  emergency_contact_name: Joi.string().optional(),
  emergency_contact_phone: Joi.string().optional(),
  emergency_contact_relationship: Joi.string().optional(),
});

// ==========================================
// Get All Patients with Pagination & Search
// ==========================================
export const getAllPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log(`📋 Getting patients - Page: ${page}, Limit: ${limit}, Search: "${search}"`);

    let whereClause = 'WHERE is_active = 1';
    let params = [];

    if (search) {
      whereClause += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm, searchTerm];
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM patients ${whereClause}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    // Get paginated results
    const patientsResult = await query(
      `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const patients = patientsResult.rows || [];

    console.log(`✅ Found ${patients.length} patients out of ${total} total`);

    res.json({
      patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
};

// ==========================================
// Get Single Patient by ID
// ==========================================
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`👤 Getting patient: ${id}`);

    const patientResult = await query(
      'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1',
      [id]
    );

    if (!patientResult.rows || patientResult.rows.length === 0) {
      console.log(`❌ Patient not found: ${id}`);
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Get recent appointments
    const appointmentsResult = await query(
      `SELECT * FROM appointments 
       WHERE patient_id = ? AND appointment_date >= date('now') 
       ORDER BY appointment_date ASC LIMIT 5`,
      [id]
    );

    // Get medical history
    const historyResult = await query(
      `SELECT * FROM medical_history 
       WHERE patient_id = ? 
       ORDER BY visit_date DESC LIMIT 10`,
      [id]
    );

    // Get current medications
    const medicationsResult = await query(
      `SELECT * FROM medications 
       WHERE patient_id = ? AND is_active = 1 
       ORDER BY start_date DESC`,
      [id]
    );

    console.log(`✅ Patient found: ${patient.first_name} ${patient.last_name}`);

    res.json({
      patient,
      appointments: appointmentsResult.rows || [],
      medical_history: historyResult.rows || [],
      medications: medicationsResult.rows || [],
    });
  } catch (error) {
    console.error('❌ Error getting patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
};

// ==========================================
// Create New Patient
// ==========================================
export const createPatient = async (req, res) => {
  try {
    // Validate input
    const { error, value } = patientSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`➕ Creating patient: ${value.first_name} ${value.last_name}`);

    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      city,
      state,
      zip_code,
      blood_type,
      allergies,
      chronic_conditions,
      insurance_provider,
      insurance_policy_number,
      insurance_group_number,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
    } = value;

    // Check if email already exists
    if (email) {
      const existing = await query(
        'SELECT patient_id FROM patients WHERE email = ?',
        [email]
      );
      if (existing.rows && existing.rows.length > 0) {
        console.log('❌ Email already exists:', email);
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const result = await query(
      `INSERT INTO patients (
        first_name, last_name, email, phone, date_of_birth, gender,
        address, city, state, zip_code, blood_type, allergies,
        chronic_conditions, insurance_provider, insurance_policy_number,
        insurance_group_number, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relationship, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name,
        last_name,
        email || null,
        phone,
        date_of_birth,
        gender || null,
        address || null,
        city || null,
        state || null,
        zip_code || null,
        blood_type || null,
        allergies || null,
        chronic_conditions || null,
        insurance_provider || null,
        insurance_policy_number || null,
        insurance_group_number || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        emergency_contact_relationship || null,
        req.user.user_id,
      ]
    );

    console.log(`✅ Patient created: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Patient created successfully',
      patient_id: result.lastID,
      patient: { patient_id: result.lastID, ...value },
    });
  } catch (error) {
    console.error('❌ Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// ==========================================
// Update Patient
// ==========================================
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    const { error, value } = patientSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✏️ Updating patient: ${id}`);

    // Check if patient exists
    const existing = await query(
      'SELECT patient_id FROM patients WHERE patient_id = ? AND is_active = 1',
      [id]
    );

    if (!existing.rows || existing.rows.length === 0) {
      console.log(`❌ Patient not found: ${id}`);
      return res.status(404).json({ error: 'Patient not found' });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      city,
      state,
      zip_code,
      blood_type,
      allergies,
      chronic_conditions,
      insurance_provider,
      insurance_policy_number,
      insurance_group_number,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
    } = value;

    await query(
      `UPDATE patients SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, date_of_birth = ?,
        gender = ?, address = ?, city = ?, state = ?, zip_code = ?,
        blood_type = ?, allergies = ?, chronic_conditions = ?,
        insurance_provider = ?, insurance_policy_number = ?, insurance_group_number = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relationship = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE patient_id = ?`,
      [
        first_name,
        last_name,
        email || null,
        phone,
        date_of_birth,
        gender || null,
        address || null,
        city || null,
        state || null,
        zip_code || null,
        blood_type || null,
        allergies || null,
        chronic_conditions || null,
        insurance_provider || null,
        insurance_policy_number || null,
        insurance_group_number || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        emergency_contact_relationship || null,
        req.user.user_id,
        id,
      ]
    );

    console.log(`✅ Patient updated: ${id}`);

    res.json({
      message: 'Patient updated successfully',
      patient_id: id,
    });
  } catch (error) {
    console.error('❌ Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

// ==========================================
// Delete Patient (Soft Delete)
// ==========================================
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting patient: ${id}`);

    const result = await query(
      'UPDATE patients SET is_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?',
      [req.user.user_id, id]
    );

    if (result.changes === 0) {
      console.log(`❌ Patient not found: ${id}`);
      return res.status(404).json({ error: 'Patient not found' });
    }

    console.log(`✅ Patient deleted: ${id}`);

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};

// ==========================================
// Search Patients
// ==========================================
export const searchPatients = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    console.log(`🔍 Searching patients: "${q}"`);

    const searchTerm = `%${q}%`;

    const result = await query(
      `SELECT patient_id, first_name, last_name, email, phone, date_of_birth
       FROM patients 
       WHERE is_active = 1 AND (
         first_name LIKE ? OR 
         last_name LIKE ? OR 
         email LIKE ? OR 
         phone LIKE ?
       )
       ORDER BY first_name ASC
       LIMIT 20`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );

    const patients = result.rows || [];
    console.log(`✅ Found ${patients.length} matches`);

    res.json({ patients });
  } catch (error) {
    console.error('❌ Error searching patients:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
};

// ==========================================
// Get Patient Medical History
// ==========================================
export const getPatientMedicalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📋 Getting medical history for patient: ${id}`);

    const result = await query(
      `SELECT * FROM medical_history 
       WHERE patient_id = ? 
       ORDER BY visit_date DESC`,
      [id]
    );

    const history = result.rows || [];
    console.log(`✅ Found ${history.length} records`);

    res.json({ medical_history: history });
  } catch (error) {
    console.error('❌ Error getting medical history:', error);
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
};

// ==========================================
// Get Patient Statistics
// ==========================================
export const getPatientStats = async (req, res) => {
  try {
    console.log('📊 Getting patient statistics');

    const totalResult = await query('SELECT COUNT(*) as total FROM patients WHERE is_active = 1');
    const appointmentsResult = await query(
      'SELECT COUNT(*) as total FROM appointments WHERE status = "Scheduled" AND appointment_date >= date("now")'
    );
    const historyResult = await query(
      'SELECT COUNT(*) as total FROM medical_history WHERE visit_date >= date("now", "-30 days")'
    );

    const stats = {
      total_patients: totalResult.rows[0]?.total || 0,
      upcoming_appointments: appointmentsResult.rows[0]?.total || 0,
      recent_visits: historyResult.rows[0]?.total || 0,
    };

    console.log(`✅ Stats retrieved:`, stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};