// ============================================
// patientController.js
// File: backend/src/controllers/patientController.js
// ============================================
import { query } from '../config/database.js';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import {
  sendPortalCredentials,
  logNotification,
} from '../services/notificationService.js';

const n = (v) => (v === '' || v === undefined) ? null : v;

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── Validation ────────────────────────────────────────────────────────────────
const patientSchema = Joi.object({
  first_name:       Joi.string().trim().required(),
  last_name:        Joi.string().trim().required(),
  date_of_birth:    Joi.string().optional().allow(null, ''),
  gender:           Joi.string().valid('Male','Female','Other').optional().allow(null, ''),
  phone:            Joi.string().trim().required(),
  email:            Joi.string().email().optional().allow(null, ''),
  address:          Joi.string().optional().allow(null, ''),
  state:            Joi.string().optional().allow(null, ''),
  lga:              Joi.string().optional().allow(null, ''),
  blood_type:       Joi.string().optional().allow(null, ''),
  genotype:         Joi.string().optional().allow(null, ''),
  allergies:        Joi.string().optional().allow(null, ''),
  chronic_conditions:Joi.string().optional().allow(null, ''),
  emergency_contact_name:  Joi.string().optional().allow(null, ''),
  emergency_contact_phone: Joi.string().optional().allow(null, ''),
  emergency_contact_relationship: Joi.string().optional().allow(null, ''),
  insurance_provider:       Joi.string().optional().allow(null, ''),
  insurance_policy_number:  Joi.string().optional().allow(null, ''),
  insurance_group_number:   Joi.string().optional().allow(null, ''),
  notes:            Joi.string().optional().allow(null, ''),
}).options({ stripUnknown: true });

// ── Generate patient number ───────────────────────────────────────────────────
const generatePatientNumber = async () => {
  const count = await getOne('SELECT COUNT(*) AS n FROM patients');
  return `PT-${String((count?.n || 0) + 1).padStart(5, '0')}`;
};

// ── Generate default portal password ─────────────────────────────────────────
const generateDefaultPassword = (lastName, phone) => {
  const part1 = lastName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toLowerCase();
  const part2 = phone.replace(/\D/g, '').slice(-4);
  return `${part1}${part2}`;
};

// ── GET /patients ─────────────────────────────────────────────────────────────
export const getAllPatients = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const offset = (page - 1) * limit;
    let where = ['p.is_active = 1'];
    const params = [];
    if (search) {
      where.push(`(p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ? OR p.patient_number LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) { where.push('p.status = ?'); params.push(status); }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM patients p ${w}`, params);
    const rows  = await getAll(
      `SELECT p.*, u.email AS login_email
       FROM patients p
       LEFT JOIN users u ON p.user_id = u.user_id
       ${w}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      patients: rows,
      pagination: {
        total: total?.n || 0, page: +page, limit: +limit,
        totalPages: Math.ceil((total?.n || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /patients/search ──────────────────────────────────────────────────────
export const searchPatients = async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const s = `%${q}%`;
    const rows = await getAll(
      `SELECT patient_id, first_name, last_name, phone, email, patient_number, date_of_birth, gender
       FROM patients
       WHERE is_active = 1 AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR patient_number LIKE ?)
       ORDER BY last_name, first_name
       LIMIT ?`,
      [s, s, s, s, limit]
    );
    res.json({ patients: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /patients/:id ─────────────────────────────────────────────────────────
export const getPatientById = async (req, res) => {
  try {
    const patient = await getOne(
      `SELECT p.*, u.email AS login_email, u.username
       FROM patients p
       LEFT JOIN users u ON p.user_id = u.user_id
       WHERE p.patient_id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /patients/me ──────────────────────────────────────────────────────────
export const getMyProfile = async (req, res) => {
  try {
    const patient = await getOne(
      `SELECT p.*, u.email, u.username, u.full_name
       FROM patients p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.user_id = ? AND p.is_active = 1`,
      [req.user.user_id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });
    res.json({ patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /patients/me ──────────────────────────────────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const { phone, address, state, lga, emergency_contact_name,
            emergency_contact_phone, emergency_contact_relationship } = req.body;

    const patient = await getOne(
      'SELECT patient_id FROM patients WHERE user_id = ? AND is_active = 1',
      [req.user.user_id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    await query(
      `UPDATE patients SET
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        state = COALESCE(?, state),
        lga = COALESCE(?, lga),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone),
        emergency_contact_relationship = COALESCE(?, emergency_contact_relationship),
        updated_at = CURRENT_TIMESTAMP
       WHERE patient_id = ?`,
      [
        n(phone), n(address), n(state), n(lga),
        n(emergency_contact_name), n(emergency_contact_phone),
        n(emergency_contact_relationship), patient.patient_id,
      ]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /patients ────────────────────────────────────────────────────────────
export const createPatient = async (req, res) => {
  try {
    const { error, value } = patientSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      first_name, last_name, date_of_birth, gender, phone, email,
      address, state, lga, blood_type, genotype, allergies,
      chronic_conditions, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relationship, insurance_provider,
      insurance_policy_number, insurance_group_number, notes,
    } = value;

    const patientNumber   = await generatePatientNumber();
    const defaultPassword = generateDefaultPassword(last_name, phone);
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10);
    const loginEmail      = email || `${patientNumber.toLowerCase()}@clinicore.patient`;
    const username        = patientNumber.toLowerCase();

    // Create user account for portal access
    const userResult = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 'patient', 1, CURRENT_TIMESTAMP)`,
      [username, loginEmail, hashedPassword, `${first_name} ${last_name}`]
    );

    const result = await query(
      `INSERT INTO patients (
        user_id, patient_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, state, lga, blood_type, genotype, allergies,
        chronic_conditions, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relationship, insurance_provider, insurance_policy_number,
        insurance_group_number, notes, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userResult.lastID, patientNumber, first_name, last_name,
        n(date_of_birth), n(gender), phone, n(email),
        n(address), n(state), n(lga), n(blood_type), n(genotype),
        n(allergies), n(chronic_conditions),
        n(emergency_contact_name), n(emergency_contact_phone),
        n(emergency_contact_relationship),
        n(insurance_provider), n(insurance_policy_number),
        n(insurance_group_number), n(notes), req.user.user_id,
      ]
    );

    const portalCredentials = { email: loginEmail, password: defaultPassword };

    console.log(`✅ Patient created: ${patientNumber}`);
    res.status(201).json({
      message:            'Patient created successfully',
      patient_id:         result.lastID,
      patient_number:     patientNumber,
      portal_credentials: portalCredentials,
    });

    // Fire-and-forget — send portal login credentials
    sendPortalCredentials({
      patientName:     `${first_name} ${last_name}`,
      patientPhone:    phone,
      patientEmail:    email || null,
      loginEmail,
      defaultPassword,
    }).then(() => logNotification(query, {
      patient_id:   result.lastID,
      type:         'portal_credentials',
      channel:      phone && email ? 'both' : phone ? 'sms' : 'email',
      recipient:    phone || loginEmail,
      body:         'Portal credentials sent on registration',
      status:       'sent',
      reference_id: String(result.lastID),
    })).catch(e => console.warn('Portal credentials notification failed (non-critical):', e.message));
  } catch (err) {
    console.error('createPatient error:', err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// ── PUT /patients/:id ─────────────────────────────────────────────────────────
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = patientSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await getOne('SELECT patient_id FROM patients WHERE patient_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    const {
      first_name, last_name, date_of_birth, gender, phone, email,
      address, state, lga, blood_type, genotype, allergies,
      chronic_conditions, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relationship, insurance_provider,
      insurance_policy_number, insurance_group_number, notes,
    } = value;

    await query(
      `UPDATE patients SET
        first_name = ?, last_name = ?, date_of_birth = ?, gender = ?,
        phone = ?, email = ?, address = ?, state = ?, lga = ?,
        blood_type = ?, genotype = ?, allergies = ?, chronic_conditions = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?,
        emergency_contact_relationship = ?,
        insurance_provider = ?, insurance_policy_number = ?,
        insurance_group_number = ?,
        notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE patient_id = ?`,
      [
        first_name, last_name, n(date_of_birth), n(gender),
        phone, n(email), n(address), n(state), n(lga),
        n(blood_type), n(genotype), n(allergies), n(chronic_conditions),
        n(emergency_contact_name), n(emergency_contact_phone),
        n(emergency_contact_relationship),
        n(insurance_provider), n(insurance_policy_number),
        n(insurance_group_number),
        n(notes), req.user.user_id, id,
      ]
    );
    res.json({ message: 'Patient updated successfully', patient_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /patients/:id (soft delete) ────────────────────────────────────────
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT patient_id FROM patients WHERE patient_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Patient not found' });
    await query(
      'UPDATE patients SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?', [id]
    );
    res.json({ message: 'Patient deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /patients/stats ───────────────────────────────────────────────────────
export const getPatientStats = async (req, res) => {
  try {
    const stats = await getOne(`
      SELECT
        COUNT(*)                                                     AS total,
        SUM(CASE WHEN gender = 'Male'   THEN 1 ELSE 0 END)          AS male,
        SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END)          AS female,
        SUM(CASE WHEN created_at >= date('now','-30 days') THEN 1 ELSE 0 END) AS new_this_month
      FROM patients WHERE is_active = 1
    `);
    res.json(stats || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};