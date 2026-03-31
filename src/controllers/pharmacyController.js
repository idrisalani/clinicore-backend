import { query } from '../config/database.js';
import Joi from 'joi';

// ==========================================
// Validation Schemas
// ==========================================

const prescriptionSchema = Joi.object({
  patient_id: Joi.number().required(),
  consultation_id: Joi.number().optional(),
  doctor_id: Joi.number().optional(),
  medication_id: Joi.number().required(),
  prescription_date: Joi.date().required(),
  prescribed_dosage: Joi.string().required(),
  frequency: Joi.string().required(),
  duration_days: Joi.number().optional(),
  quantity: Joi.number().required(),
  refills_remaining: Joi.number().optional(),
  instructions: Joi.string().optional(),
  special_instructions: Joi.string().optional(),
  status: Joi.string().valid('Active', 'Completed', 'Cancelled', 'Suspended').optional(),
  expiry_date: Joi.date().optional(),
  notes: Joi.string().optional(),
});

const medicationSchema = Joi.object({
  generic_name: Joi.string().required(),
  brand_name: Joi.string().optional(),
  drug_code: Joi.string().optional(),
  drug_class: Joi.string().optional(),
  strength: Joi.string().optional(),
  unit: Joi.string().optional(),
  default_dosage: Joi.string().optional(),
  default_frequency: Joi.string().optional(),
  unit_cost: Joi.number().optional(),
  is_active: Joi.number().optional(),
});

// ==========================================
// PRESCRIPTIONS ENDPOINTS
// ==========================================

export const getAllPrescriptions = async (req, res) => {
  try {
    const { page = 1, limit = 10, patient_id = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('💊 Getting prescriptions...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (patient_id) {
      whereClause += ' AND p.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM prescriptions ${whereClause}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    const prescriptionsResult = await query(
      `SELECT p.*, pat.first_name, pat.last_name, m.generic_name, m.brand_name
       FROM prescriptions p
       JOIN patients pat ON p.patient_id = pat.patient_id
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       ${whereClause}
       ORDER BY p.prescription_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const prescriptions = prescriptionsResult.rows || [];

    console.log(`✅ Found ${prescriptions.length} prescriptions`);

    res.json({
      prescriptions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error getting prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💊 Getting prescription: ${id}`);

    const result = await query(
      `SELECT p.*, pat.first_name, pat.last_name, pat.phone, m.generic_name, m.brand_name, m.drug_class
       FROM prescriptions p
       JOIN patients pat ON p.patient_id = pat.patient_id
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       WHERE p.prescription_id = ?`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    console.log('✅ Prescription found');

    res.json({ prescription: result.rows[0] });
  } catch (error) {
    console.error('❌ Error getting prescription:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
};

export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;

    console.log(`💊 Getting prescriptions for patient: ${patientId}`);

    const result = await query(
      `SELECT p.*, m.generic_name, m.brand_name, m.drug_class
       FROM prescriptions p
       JOIN medication_catalog m ON p.medication_id = m.medication_id
       WHERE p.patient_id = ?
       ORDER BY p.prescription_date DESC`,
      [patientId]
    );

    const prescriptions = result.rows || [];

    console.log(`✅ Found ${prescriptions.length} prescriptions`);

    res.json({ prescriptions });
  } catch (error) {
    console.error('❌ Error getting patient prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
};

export const createPrescription = async (req, res) => {
  try {
    const { error, value } = prescriptionSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating prescription...');

    const {
      patient_id,
      consultation_id,
      doctor_id,
      medication_id,
      prescription_date,
      prescribed_dosage,
      frequency,
      duration_days,
      quantity,
      refills_remaining,
      instructions,
      special_instructions,
      status,
      expiry_date,
      notes,
    } = value;

    const result = await query(
      `INSERT INTO prescriptions (
        patient_id, consultation_id, doctor_id, medication_id,
        prescription_date, prescribed_dosage, frequency, duration_days,
        quantity, refills_remaining, instructions, special_instructions,
        status, expiry_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        consultation_id || null,
        doctor_id || req.user.user_id,
        medication_id,
        prescription_date,
        prescribed_dosage,
        frequency,
        duration_days || null,
        quantity,
        refills_remaining || 0,
        instructions || null,
        special_instructions || null,
        status || 'Active',
        expiry_date || null,
        notes || null,
        req.user.user_id,
      ]
    );

    console.log(`✅ Prescription created: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Prescription created successfully',
      prescription_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating prescription:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
};

export const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = prescriptionSchema.validate(req.body);

    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✏️ Updating prescription: ${id}`);

    const existing = await query(
      'SELECT prescription_id FROM prescriptions WHERE prescription_id = ?',
      [id]
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const {
      patient_id,
      consultation_id,
      doctor_id,
      medication_id,
      prescription_date,
      prescribed_dosage,
      frequency,
      duration_days,
      quantity,
      refills_remaining,
      instructions,
      special_instructions,
      status,
      expiry_date,
      notes,
    } = value;

    await query(
      `UPDATE prescriptions SET
        patient_id = ?, consultation_id = ?, doctor_id = ?,
        medication_id = ?, prescription_date = ?, prescribed_dosage = ?,
        frequency = ?, duration_days = ?, quantity = ?,
        refills_remaining = ?, instructions = ?, special_instructions = ?,
        status = ?, expiry_date = ?, notes = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE prescription_id = ?`,
      [
        patient_id,
        consultation_id || null,
        doctor_id || req.user.user_id,
        medication_id,
        prescription_date,
        prescribed_dosage,
        frequency,
        duration_days || null,
        quantity,
        refills_remaining || 0,
        instructions || null,
        special_instructions || null,
        status || 'Active',
        expiry_date || null,
        notes || null,
        req.user.user_id,
        id,
      ]
    );

    console.log(`✅ Prescription updated: ${id}`);

    res.json({ message: 'Prescription updated successfully', prescription_id: id });
  } catch (error) {
    console.error('❌ Error updating prescription:', error);
    res.status(500).json({ error: 'Failed to update prescription' });
  }
};

export const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting prescription: ${id}`);

    const result = await query(
      'DELETE FROM prescriptions WHERE prescription_id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    console.log(`✅ Prescription deleted: ${id}`);

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting prescription:', error);
    res.status(500).json({ error: 'Failed to delete prescription' });
  }
};

// ==========================================
// MEDICATIONS ENDPOINTS
// ==========================================

export const getAllMedications = async (req, res) => {
  try {
    const { search = '', is_active = 1 } = req.query;

    console.log('💊 Getting medications...');

    let whereClause = 'WHERE is_active = ?';
    let params = [is_active];

    if (search) {
      whereClause += ' AND (generic_name LIKE ? OR brand_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const result = await query(
      `SELECT * FROM medication_catalog ${whereClause} ORDER BY generic_name`,
      params
    );

    const medications = result.rows || [];

    console.log(`✅ Found ${medications.length} medications`);

    res.json({ medications });
  } catch (error) {
    console.error('❌ Error getting medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
};

export const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💊 Getting medication: ${id}`);

    const result = await query(
      'SELECT * FROM medication_catalog WHERE medication_id = ?',
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    console.log('✅ Medication found');

    res.json({ medication: result.rows[0] });
  } catch (error) {
    console.error('❌ Error getting medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
};

export const createMedication = async (req, res) => {
  try {
    const { error, value } = medicationSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('➕ Creating medication...');

    const {
      generic_name,
      brand_name,
      drug_code,
      drug_class,
      strength,
      unit,
      default_dosage,
      default_frequency,
      unit_cost,
      is_active,
    } = value;

    const result = await query(
      `INSERT INTO medication_catalog (
        generic_name, brand_name, drug_code, drug_class,
        strength, unit, default_dosage, default_frequency,
        unit_cost, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generic_name,
        brand_name || null,
        drug_code || null,
        drug_class || null,
        strength || null,
        unit || null,
        default_dosage || null,
        default_frequency || null,
        unit_cost || null,
        is_active !== undefined ? is_active : 1,
      ]
    );

    console.log(`✅ Medication created: ID ${result.lastID}`);

    res.status(201).json({
      message: 'Medication created successfully',
      medication_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating medication:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  }
};

// ==========================================
// PHARMACY STATISTICS
// ==========================================

export const getPharmacyStats = async (req, res) => {
  try {
    console.log('📊 Getting pharmacy statistics');

    const stats = {};

    // Total prescriptions
    const totalResult = await query('SELECT COUNT(*) as total FROM prescriptions');
    stats.total_prescriptions = totalResult.rows[0]?.total || 0;

    // Active prescriptions
    const activeResult = await query(
      "SELECT COUNT(*) as total FROM prescriptions WHERE status = 'Active'"
    );
    stats.active_prescriptions = activeResult.rows[0]?.total || 0;

    // By status
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM prescriptions
      GROUP BY status
    `);

    stats.by_status = {};
    statusResult.rows?.forEach(row => {
      stats.by_status[row.status] = row.count;
    });

    // Total medications in catalog
    const medicationsResult = await query('SELECT COUNT(*) as total FROM medication_catalog');
    stats.total_medications = medicationsResult.rows[0]?.total || 0;

    // Medications needing refill (< 5 refills remaining)
    const refillResult = await query(
      'SELECT COUNT(*) as total FROM prescriptions WHERE status = "Active" AND refills_remaining < 5'
    );
    stats.medications_needing_refill = refillResult.rows[0]?.total || 0;

    console.log('✅ Statistics retrieved:', stats);

    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};