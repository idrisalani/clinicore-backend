// ============================================
// facilityController.js
// File: backend/src/controllers/facilityController.js
// ============================================
import { query } from '../config/database.js';

const n      = (v)       => (v === '' || v === undefined) ? null : v;
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── GET /facilities — list all (super-admin only) ─────────────────────────────
export const getAllFacilities = async (req, res) => {
  try {
    const { is_active = 1 } = req.query;
    const rows = await getAll(
      `SELECT f.*,
         (SELECT COUNT(*) FROM users    u WHERE u.facility_id = f.facility_id) AS user_count,
         (SELECT COUNT(*) FROM patients p WHERE p.facility_id = f.facility_id) AS patient_count,
         (SELECT COUNT(*) FROM appointments a WHERE a.facility_id = f.facility_id) AS appointment_count
       FROM facilities f
       WHERE f.is_active = ?
       ORDER BY f.name ASC`,
      [is_active]
    );
    res.json({ facilities: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /facilities/current — current user's facility ────────────────────────
export const getCurrentFacility = async (req, res) => {
  try {
    const facility = await getOne(
      'SELECT * FROM facilities WHERE facility_id = ? AND is_active = 1',
      [req.facilityId]
    );
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    // Attach stats
    const [users, patients, appts] = await Promise.all([
      getOne('SELECT COUNT(*) AS n FROM users WHERE facility_id = ?',        [req.facilityId]),
      getOne('SELECT COUNT(*) AS n FROM patients WHERE facility_id = ?',     [req.facilityId]),
      getOne("SELECT COUNT(*) AS n FROM appointments WHERE facility_id = ? AND appointment_date = date('now')", [req.facilityId]),
    ]);

    res.json({
      facility: {
        ...facility,
        stats: {
          total_users:        users?.n     || 0,
          total_patients:     patients?.n  || 0,
          todays_appointments:appts?.n     || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /facilities/:id ───────────────────────────────────────────────────────
export const getFacilityById = async (req, res) => {
  try {
    const facility = await getOne(
      'SELECT * FROM facilities WHERE facility_id = ?', [req.params.id]
    );
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    res.json({ facility });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /facilities — create new facility ────────────────────────────────────
export const createFacility = async (req, res) => {
  try {
    const {
      name, facility_type, address, state, lga,
      phone, email, rc_number, lashma_id, license_number,
      primary_color, timezone, currency, subscription_plan,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Facility name is required' });

    const result = await query(
      `INSERT INTO facilities
        (name, facility_type, address, state, lga, phone, email,
         rc_number, lashma_id, license_number, primary_color,
         timezone, currency, subscription_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, facility_type || 'Clinic',
        n(address), n(state) || 'Lagos', n(lga),
        n(phone), n(email), n(rc_number), n(lashma_id), n(license_number),
        primary_color || '#0F6E56',
        timezone || 'Africa/Lagos',
        currency || 'NGN',
        subscription_plan || 'starter',
      ]
    );

    console.log(`✅ Facility created: "${name}" (ID: ${result.lastID})`);
    res.status(201).json({
      message:     'Facility created successfully',
      facility_id: result.lastID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /facilities/:id — update facility settings ────────────────────────────
export const updateFacility = async (req, res) => {
  try {
    const { id } = req.params;

    // Non-admins can only update their own facility
    if (req.user.role !== 'admin' && req.facilityId !== Number(id)) {
      return res.status(403).json({ error: 'Cannot update another facility' });
    }

    const existing = await getOne('SELECT facility_id FROM facilities WHERE facility_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Facility not found' });

    const {
      name, facility_type, address, state, lga,
      phone, email, rc_number, lashma_id, license_number,
      primary_color, logo_url, timezone, currency,
    } = req.body;

    await query(
      `UPDATE facilities SET
        name            = COALESCE(?, name),
        facility_type   = COALESCE(?, facility_type),
        address         = COALESCE(?, address),
        state           = COALESCE(?, state),
        lga             = COALESCE(?, lga),
        phone           = COALESCE(?, phone),
        email           = COALESCE(?, email),
        rc_number       = COALESCE(?, rc_number),
        lashma_id       = COALESCE(?, lashma_id),
        license_number  = COALESCE(?, license_number),
        primary_color   = COALESCE(?, primary_color),
        logo_url        = COALESCE(?, logo_url),
        timezone        = COALESCE(?, timezone),
        currency        = COALESCE(?, currency),
        updated_at      = CURRENT_TIMESTAMP
       WHERE facility_id = ?`,
      [
        n(name), n(facility_type), n(address), n(state), n(lga),
        n(phone), n(email), n(rc_number), n(lashma_id), n(license_number),
        n(primary_color), n(logo_url), n(timezone), n(currency), id,
      ]
    );
    res.json({ message: 'Facility updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /facilities/:id/deactivate ────────────────────────────────────────────
export const deactivateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ error: 'Cannot deactivate the primary facility' });
    }
    await query(
      'UPDATE facilities SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE facility_id = ?',
      [id]
    );
    res.json({ message: 'Facility deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /facilities/:id/stats — dashboard stats per facility ──────────────────
export const getFacilityStats = async (req, res) => {
  try {
    const fid = req.params.id || req.facilityId;

    const [patients, appts, consultations, revenue] = await Promise.all([
      getOne(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at >= date('now','-30 days') THEN 1 ELSE 0 END) AS new_month
              FROM patients WHERE facility_id = ? AND is_active = 1`, [fid]),
      getOne(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN appointment_date = date('now') THEN 1 ELSE 0 END) AS today
              FROM appointments WHERE facility_id = ?`, [fid]),
      getOne(`SELECT COUNT(*) AS total
              FROM consultations WHERE facility_id = ?`, [fid]),
      getOne(`SELECT COALESCE(SUM(total_amount),0) AS total,
                COALESCE(SUM(CASE WHEN payment_status='Paid' THEN total_amount ELSE 0 END),0) AS collected
              FROM invoices WHERE facility_id = ?`, [fid]),
    ]);

    res.json({
      facility_id:   Number(fid),
      patients:      { total: patients?.total || 0, new_this_month: patients?.new_month || 0 },
      appointments:  { total: appts?.total || 0, today: appts?.today || 0 },
      consultations: { total: consultations?.total || 0 },
      revenue:       { total: revenue?.total || 0, collected: revenue?.collected || 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};