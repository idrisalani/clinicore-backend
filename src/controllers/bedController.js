// ============================================
// bedController.js
// File: backend/src/controllers/bedController.js
// ============================================
import { query } from '../config/database.js';

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];
const n      = (v) => (v === '' || v === undefined) ? null : v;

// ═══════════════════════════════════════════════════════════
// WARDS
// ═══════════════════════════════════════════════════════════

export const getAllWards = async (req, res) => {
  try {
    const rows = await getAll(`
      SELECT w.*,
        u.full_name AS head_nurse_name,
        COUNT(b.bed_id)                                               AS total_beds,
        SUM(CASE WHEN b.status = 'Available'   AND b.is_active=1 THEN 1 ELSE 0 END) AS available,
        SUM(CASE WHEN b.status = 'Occupied'    AND b.is_active=1 THEN 1 ELSE 0 END) AS occupied,
        SUM(CASE WHEN b.status = 'Reserved'    AND b.is_active=1 THEN 1 ELSE 0 END) AS reserved,
        SUM(CASE WHEN b.status = 'Maintenance' AND b.is_active=1 THEN 1 ELSE 0 END) AS maintenance,
        SUM(CASE WHEN b.status = 'Cleaning'    AND b.is_active=1 THEN 1 ELSE 0 END) AS cleaning
      FROM wards w
      LEFT JOIN users u ON w.head_nurse_id = u.user_id
      LEFT JOIN beds b  ON b.ward_id = w.ward_id
      WHERE w.is_active = 1
      GROUP BY w.ward_id
      ORDER BY w.name ASC
    `);
    res.json({ wards: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getWardById = async (req, res) => {
  try {
    const ward = await getOne(`
      SELECT w.*, u.full_name AS head_nurse_name
      FROM wards w LEFT JOIN users u ON w.head_nurse_id = u.user_id
      WHERE w.ward_id = ? AND w.is_active = 1
    `, [req.params.id]);
    if (!ward) return res.status(404).json({ error: 'Ward not found' });

    const beds = await getAll(`
      SELECT b.*,
        a.admission_id, a.patient_id, a.admission_date, a.admission_reason,
        a.expected_discharge, a.admission_type,
        p.first_name, p.last_name, p.phone
      FROM beds b
      LEFT JOIN bed_admissions a ON a.bed_id = b.bed_id AND a.status = 'Active'
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      WHERE b.ward_id = ? AND b.is_active = 1
      ORDER BY b.bed_number ASC
    `, [req.params.id]);

    res.json({ ward, beds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createWard = async (req, res) => {
  try {
    const { name, ward_type, floor, total_beds, description, head_nurse_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Ward name is required' });

    const result = await query(
      `INSERT INTO wards (name, ward_type, floor, total_beds, description, head_nurse_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, ward_type || 'General', n(floor), total_beds || 0, n(description), n(head_nurse_id)]
    );
    res.status(201).json({ message: 'Ward created', ward_id: result.lastID });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Ward name already exists' });
    res.status(500).json({ error: err.message });
  }
};

export const updateWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ward_type, floor, total_beds, description, head_nurse_id } = req.body;
    await query(
      `UPDATE wards SET name=COALESCE(?,name), ward_type=COALESCE(?,ward_type),
        floor=COALESCE(?,floor), total_beds=COALESCE(?,total_beds),
        description=COALESCE(?,description), head_nurse_id=COALESCE(?,head_nurse_id),
        updated_at=CURRENT_TIMESTAMP
       WHERE ward_id=?`,
      [n(name), n(ward_type), n(floor), n(total_beds), n(description), n(head_nurse_id), id]
    );
    res.json({ message: 'Ward updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// BEDS
// ═══════════════════════════════════════════════════════════

export const getAllBeds = async (req, res) => {
  try {
    const { ward_id, status, bed_type } = req.query;
    let where = ['b.is_active = 1'];
    const params = [];
    if (ward_id)  { where.push('b.ward_id = ?');  params.push(ward_id);  }
    if (status)   { where.push('b.status = ?');   params.push(status);   }
    if (bed_type) { where.push('b.bed_type = ?'); params.push(bed_type); }

    const rows = await getAll(`
      SELECT b.*, w.name AS ward_name, w.ward_type, w.floor,
        a.admission_id, a.admission_date, a.expected_discharge, a.admission_reason,
        p.first_name, p.last_name, p.phone, p.patient_id AS admitted_patient_id
      FROM beds b
      JOIN wards w ON b.ward_id = w.ward_id
      LEFT JOIN bed_admissions a ON a.bed_id = b.bed_id AND a.status = 'Active'
      LEFT JOIN patients p ON a.patient_id = p.patient_id
      WHERE ${where.join(' AND ')}
      ORDER BY w.name ASC, b.bed_number ASC
    `, params);
    res.json({ beds: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBedById = async (req, res) => {
  try {
    const bed = await getOne(`
      SELECT b.*, w.name AS ward_name, w.ward_type, w.floor
      FROM beds b JOIN wards w ON b.ward_id = w.ward_id
      WHERE b.bed_id = ? AND b.is_active = 1
    `, [req.params.id]);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });

    const history = await getAll(`
      SELECT a.*,
        p.first_name, p.last_name, p.phone,
        u.full_name AS doctor_name
      FROM bed_admissions a
      JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN users u ON a.admitting_doctor_id = u.user_id
      WHERE a.bed_id = ?
      ORDER BY a.admission_date DESC LIMIT 10
    `, [req.params.id]);

    res.json({ bed, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createBed = async (req, res) => {
  try {
    const { ward_id, bed_number, bed_type, features, notes } = req.body;
    if (!ward_id)    return res.status(400).json({ error: 'ward_id is required' });
    if (!bed_number) return res.status(400).json({ error: 'bed_number is required' });

    const result = await query(
      `INSERT INTO beds (ward_id, bed_number, bed_type, features, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [ward_id, bed_number, bed_type || 'Standard', n(features), n(notes)]
    );
    res.status(201).json({ message: 'Bed created', bed_id: result.lastID });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Bed number already exists in this ward' });
    res.status(500).json({ error: err.message });
  }
};

export const updateBedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const validStatuses = ['Available','Occupied','Reserved','Maintenance','Cleaning'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }

    const bed = await getOne('SELECT * FROM beds WHERE bed_id = ? AND is_active = 1', [id]);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });

    // Prevent manual 'Occupied' — use admission endpoint instead
    if (status === 'Occupied' && bed.status !== 'Occupied') {
      return res.status(400).json({ error: 'Use the admit patient endpoint to mark a bed as Occupied' });
    }

    await query(
      'UPDATE beds SET status=?, notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE bed_id=?',
      [status, n(notes), id]
    );
    res.json({ message: `Bed status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBed = async (req, res) => {
  try {
    const bed = await getOne("SELECT * FROM beds WHERE bed_id = ?", [req.params.id]);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    if (bed.status === 'Occupied') return res.status(400).json({ error: 'Cannot delete an occupied bed' });
    await query('UPDATE beds SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE bed_id=?', [req.params.id]);
    res.json({ message: 'Bed deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// ADMISSIONS
// ═══════════════════════════════════════════════════════════

export const getAllAdmissions = async (req, res) => {
  try {
    const { page=1, limit=20, status='Active', ward_id, patient_id } = req.query;
    const offset = (page-1)*limit;
    let where = ['1=1'];
    const params = [];
    if (status)    { where.push('a.status = ?');     params.push(status);    }
    if (ward_id)   { where.push('a.ward_id = ?');    params.push(ward_id);   }
    if (patient_id){ where.push('a.patient_id = ?'); params.push(patient_id);}

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM bed_admissions a ${w}`, params);
    const rows  = await getAll(`
      SELECT a.*,
        p.first_name, p.last_name, p.phone,
        b.bed_number, w.name AS ward_name, w.ward_type,
        u.full_name AS doctor_name
      FROM bed_admissions a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN beds b     ON a.bed_id = b.bed_id
      JOIN wards w    ON a.ward_id = w.ward_id
      LEFT JOIN users u ON a.admitting_doctor_id = u.user_id
      ${w}
      ORDER BY a.admission_date DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      admissions: rows,
      pagination: { total: total?.n||0, page:+page, limit:+limit,
                    totalPages: Math.ceil((total?.n||0)/limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAdmissionById = async (req, res) => {
  try {
    const admission = await getOne(`
      SELECT a.*,
        p.first_name, p.last_name, p.phone, p.blood_type, p.allergies,
        b.bed_number, b.bed_type, b.features,
        w.name AS ward_name, w.ward_type, w.floor,
        u.full_name AS doctor_name
      FROM bed_admissions a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN beds b     ON a.bed_id = b.bed_id
      JOIN wards w    ON a.ward_id = w.ward_id
      LEFT JOIN users u ON a.admitting_doctor_id = u.user_id
      WHERE a.admission_id = ?
    `, [req.params.id]);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });
    res.json({ admission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const admitPatient = async (req, res) => {
  try {
    const {
      bed_id, patient_id, admitting_doctor_id, consultation_id,
      admission_type, admission_reason, diagnosis, expected_discharge,
    } = req.body;

    if (!bed_id)          return res.status(400).json({ error: 'bed_id is required' });
    if (!patient_id)      return res.status(400).json({ error: 'patient_id is required' });
    if (!admission_reason)return res.status(400).json({ error: 'admission_reason is required' });

    // Check bed is available
    const bed = await getOne(
      "SELECT * FROM beds WHERE bed_id = ? AND is_active = 1", [bed_id]
    );
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    if (bed.status !== 'Available' && bed.status !== 'Reserved') {
      return res.status(400).json({ error: `Bed is currently ${bed.status} — cannot admit` });
    }

    // Check patient not already admitted
    const existing = await getOne(
      "SELECT admission_id FROM bed_admissions WHERE patient_id=? AND status='Active'",
      [patient_id]
    );
    if (existing) {
      return res.status(400).json({ error: 'Patient already has an active admission', admission_id: existing.admission_id });
    }

    // Create admission
    const result = await query(
      `INSERT INTO bed_admissions (
        bed_id, ward_id, patient_id, consultation_id, admitting_doctor_id,
        admission_type, admission_reason, diagnosis, expected_discharge,
        admitted_by, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,'Active')`,
      [
        bed_id, bed.ward_id, patient_id, n(consultation_id),
        n(admitting_doctor_id), admission_type || 'Elective',
        admission_reason, n(diagnosis), n(expected_discharge),
        req.user.user_id,
      ]
    );

    // Mark bed as Occupied
    await query(
      "UPDATE beds SET status='Occupied', updated_at=CURRENT_TIMESTAMP WHERE bed_id=?",
      [bed_id]
    );

    console.log(`✅ Patient ${patient_id} admitted to bed ${bed_id}`);
    res.status(201).json({
      message:      'Patient admitted successfully',
      admission_id: result.lastID,
      bed_number:   bed.bed_number,
    });
  } catch (err) {
    console.error('admitPatient error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const dischargePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { discharge_notes, discharge_type } = req.body;

    const admission = await getOne(
      "SELECT * FROM bed_admissions WHERE admission_id=? AND status='Active'", [id]
    );
    if (!admission) return res.status(404).json({ error: 'Active admission not found' });

    // Update admission record
    await query(
      `UPDATE bed_admissions SET
        status='Discharged', actual_discharge=CURRENT_TIMESTAMP,
        discharge_notes=?, discharge_type=?, discharged_by=?, updated_at=CURRENT_TIMESTAMP
       WHERE admission_id=?`,
      [n(discharge_notes), n(discharge_type), req.user.user_id, id]
    );

    // Move bed to Cleaning (ready for next patient after cleaning)
    await query(
      "UPDATE beds SET status='Cleaning', updated_at=CURRENT_TIMESTAMP WHERE bed_id=?",
      [admission.bed_id]
    );

    console.log(`✅ Admission ${id} discharged — bed ${admission.bed_id} → Cleaning`);
    res.json({ message: 'Patient discharged — bed marked for cleaning' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const transferPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_bed_id, transfer_reason } = req.body;
    if (!new_bed_id) return res.status(400).json({ error: 'new_bed_id is required' });

    const admission = await getOne(
      "SELECT * FROM bed_admissions WHERE admission_id=? AND status='Active'", [id]
    );
    if (!admission) return res.status(404).json({ error: 'Active admission not found' });

    const newBed = await getOne(
      "SELECT * FROM beds WHERE bed_id=? AND is_active=1", [new_bed_id]
    );
    if (!newBed) return res.status(404).json({ error: 'Target bed not found' });
    if (!['Available','Reserved'].includes(newBed.status)) {
      return res.status(400).json({ error: `Target bed is ${newBed.status}` });
    }

    // Free old bed, occupy new bed
    await query("UPDATE beds SET status='Cleaning', updated_at=CURRENT_TIMESTAMP WHERE bed_id=?",
      [admission.bed_id]);
    await query("UPDATE beds SET status='Occupied', updated_at=CURRENT_TIMESTAMP WHERE bed_id=?",
      [new_bed_id]);

    // Update admission record
    await query(
      `UPDATE bed_admissions SET
        bed_id=?, ward_id=?, status='Transferred',
        discharge_notes=?, actual_discharge=CURRENT_TIMESTAMP,
        discharged_by=?, updated_at=CURRENT_TIMESTAMP
       WHERE admission_id=?`,
      [new_bed_id, newBed.ward_id, n(transfer_reason), req.user.user_id, id]
    );

    // Create new admission record for the new bed
    const result = await query(
      `INSERT INTO bed_admissions (
        bed_id, ward_id, patient_id, consultation_id, admitting_doctor_id,
        admission_type, admission_reason, admitted_by, status
      ) VALUES (?,?,?,?,?,'Transfer',?,?,'Active')`,
      [
        new_bed_id, newBed.ward_id, admission.patient_id,
        admission.consultation_id, admission.admitting_doctor_id,
        transfer_reason || `Transferred from bed ${admission.bed_id}`,
        req.user.user_id,
      ]
    );

    res.json({ message: 'Patient transferred', new_admission_id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// STATS & OVERVIEW
// ═══════════════════════════════════════════════════════════

export const getBedStats = async (req, res) => {
  try {
    const [bedStats, wardStats, recentAdmissions] = await Promise.all([
      getOne(`
        SELECT
          COUNT(*)                                                          AS total_beds,
          SUM(CASE WHEN status='Available'   AND is_active=1 THEN 1 ELSE 0 END) AS available,
          SUM(CASE WHEN status='Occupied'    AND is_active=1 THEN 1 ELSE 0 END) AS occupied,
          SUM(CASE WHEN status='Reserved'    AND is_active=1 THEN 1 ELSE 0 END) AS reserved,
          SUM(CASE WHEN status='Maintenance' AND is_active=1 THEN 1 ELSE 0 END) AS maintenance,
          SUM(CASE WHEN status='Cleaning'    AND is_active=1 THEN 1 ELSE 0 END) AS cleaning,
          ROUND(100.0 * SUM(CASE WHEN status='Occupied' AND is_active=1 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*),0), 1) AS occupancy_rate
        FROM beds WHERE is_active=1
      `),
      getAll(`
        SELECT w.name, w.ward_type,
          SUM(CASE WHEN b.status='Available' THEN 1 ELSE 0 END) AS available,
          SUM(CASE WHEN b.status='Occupied'  THEN 1 ELSE 0 END) AS occupied,
          COUNT(b.bed_id) AS total
        FROM wards w LEFT JOIN beds b ON b.ward_id=w.ward_id AND b.is_active=1
        WHERE w.is_active=1
        GROUP BY w.ward_id ORDER BY w.name ASC
      `),
      getAll(`
        SELECT a.admission_id, a.admission_date, a.admission_type,
          p.first_name, p.last_name,
          b.bed_number, w.name AS ward_name
        FROM bed_admissions a
        JOIN patients p ON a.patient_id=p.patient_id
        JOIN beds b ON a.bed_id=b.bed_id
        JOIN wards w ON a.ward_id=w.ward_id
        WHERE a.status='Active'
        ORDER BY a.admission_date DESC LIMIT 10
      `),
    ]);

    res.json({ summary: bedStats, by_ward: wardStats, recent_admissions: recentAdmissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPatientAdmissions = async (req, res) => {
  try {
    const rows = await getAll(`
      SELECT a.*,
        b.bed_number, w.name AS ward_name,
        u.full_name AS doctor_name
      FROM bed_admissions a
      JOIN beds b  ON a.bed_id  = b.bed_id
      JOIN wards w ON a.ward_id = w.ward_id
      LEFT JOIN users u ON a.admitting_doctor_id = u.user_id
      WHERE a.patient_id = ?
      ORDER BY a.admission_date DESC
    `, [req.params.patientId]);
    res.json({ admissions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};