// ============================================
// Database Auto-Initialization Wrapper
// File: backend/src/database/autoInit.js
// ============================================
import db from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helper: run ALTER TABLE, silently ignore duplicate column errors ───────────
const safeAlter = (sql) => new Promise((resolve) => {
  db.run(sql, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.warn('⚠️  Migration warning:', err.message);
    }
    resolve();
  });
});

export function checkTablesExist() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      (err, tables) => {
        if (err) reject(err);
        resolve(tables && tables.length > 0);
      }
    );
  });
}

// ── medication_catalog inventory columns ──────────────────────────────────────
async function ensureInventoryColumns() {
  const cols = [
    "ALTER TABLE medication_catalog ADD COLUMN stock_quantity    INTEGER DEFAULT 0",
    "ALTER TABLE medication_catalog ADD COLUMN reorder_level     INTEGER DEFAULT 10",
    "ALTER TABLE medication_catalog ADD COLUMN expiry_date       TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN batch_number      TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_name     TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_phone    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_email    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN storage_location  TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN last_restocked_at TEXT",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ medication_catalog inventory columns verified');
}

// ── activity_logs missing columns ─────────────────────────────────────────────
async function ensureActivityLogsColumns() {
  const cols = [
    "ALTER TABLE activity_logs ADD COLUMN resource_type TEXT",
    "ALTER TABLE activity_logs ADD COLUMN resource_id   INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ activity_logs columns verified');
}

// ── appointments telemedicine columns ─────────────────────────────────────────
async function ensureAppointmentColumns() {
  const cols = [
    "ALTER TABLE appointments ADD COLUMN appointment_type TEXT DEFAULT 'In-Person'",
    "ALTER TABLE appointments ADD COLUMN meeting_url      TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_room_id  TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_token    TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_password TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_provider TEXT DEFAULT 'daily'",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ appointments columns verified');
}

// ── invoices insurance columns ────────────────────────────────────────────────
async function ensureInvoiceColumns() {
  const cols = [
    "ALTER TABLE invoices ADD COLUMN insurance_provider       TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_policy_number  TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_number   TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_status   TEXT DEFAULT 'None'",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ invoices columns verified');
}

// ── Main auto-initialize ──────────────────────────────────────────────────────
export async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();

    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization');
    } else {
      console.log('🔧 Database tables not found - initializing...');
      const initScriptPath = path.join(__dirname, 'init_SIMPLE.js');
      if (!fs.existsSync(initScriptPath)) {
        throw new Error('init_SIMPLE.js not found at ' + initScriptPath);
      }
      const { initializeDatabase } = await import('./init_SIMPLE.js');
      await initializeDatabase();
      console.log('✅ Database auto-initialized successfully!');
    }

    // Always run all column migrations — safe on every restart
    await ensureInventoryColumns();
    await ensureActivityLogsColumns();
    await ensureAppointmentColumns();
    await ensureInvoiceColumns();

    return true;
  } catch (err) {
    console.error('❌ Database auto-initialization failed:', err.message);
    return false;
  }
}

export async function initDatabaseOnStartup() {
  console.log('🔍 Checking database status...');
  try {
    const initialized = await autoInitializeDatabase();
    if (initialized) {
      console.log('✅ Database ready for use');
      return true;
    } else {
      console.log('⚠️  Database check completed with warnings');
      return false;
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    return false;
  }
}// ============================================
// autoInit.js
// File: backend/src/database/autoInit.js
//
// Runs on every Render startup — all safeAlter
// calls are idempotent (duplicate column errors
// are silently ignored). Add new migrations here
// rather than creating separate migration files.
// ============================================
import db from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helper: ALTER TABLE, silently ignore duplicate column errors ───────────────
const safeAlter = (sql) => new Promise((resolve) => {
  db.run(sql, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.warn('⚠️  Migration warning:', err.message);
    }
    resolve();
  });
});

// ── Helper: CREATE TABLE / INDEX, silently ignore already-exists ──────────────
const safeCreate = (sql) => new Promise((resolve) => {
  db.run(sql, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.warn('⚠️  Create warning:', err.message);
    }
    resolve();
  });
});

// ── Helper: run a plain query, never throws ───────────────────────────────────
const safeRun = (sql, params = []) => new Promise((resolve) => {
  db.run(sql, params, (err) => {
    if (err) console.warn('⚠️  Query warning:', err.message);
    resolve();
  });
});

export function checkTablesExist() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      (err, tables) => {
        if (err) reject(err);
        resolve(tables && tables.length > 0);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN MIGRATIONS (idempotent — safe on every restart)
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. medication_catalog inventory columns ───────────────────────────────────
async function ensureInventoryColumns() {
  const cols = [
    "ALTER TABLE medication_catalog ADD COLUMN stock_quantity    INTEGER DEFAULT 0",
    "ALTER TABLE medication_catalog ADD COLUMN reorder_level     INTEGER DEFAULT 10",
    "ALTER TABLE medication_catalog ADD COLUMN expiry_date       TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN batch_number      TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_name     TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_phone    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_email    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN storage_location  TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN last_restocked_at TEXT",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ medication_catalog inventory columns verified');
}

// ── 2. activity_logs columns ──────────────────────────────────────────────────
async function ensureActivityLogsColumns() {
  const cols = [
    "ALTER TABLE activity_logs ADD COLUMN resource_type TEXT",
    "ALTER TABLE activity_logs ADD COLUMN resource_id   INTEGER",
    "ALTER TABLE activity_logs ADD COLUMN http_method   TEXT",
    "ALTER TABLE activity_logs ADD COLUMN endpoint      TEXT",
    "ALTER TABLE activity_logs ADD COLUMN status_code   INTEGER",
    "ALTER TABLE activity_logs ADD COLUMN user_agent    TEXT",
    "ALTER TABLE activity_logs ADD COLUMN description   TEXT",
    "ALTER TABLE activity_logs ADD COLUMN facility_id   INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ activity_logs columns verified');
}

// ── 3. appointments columns ───────────────────────────────────────────────────
async function ensureAppointmentColumns() {
  const cols = [
    "ALTER TABLE appointments ADD COLUMN appointment_type TEXT DEFAULT 'In-Person'",
    "ALTER TABLE appointments ADD COLUMN meeting_url      TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_room_id  TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_token    TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_password TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_provider TEXT DEFAULT 'daily'",
    "ALTER TABLE appointments ADD COLUMN facility_id      INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ appointments columns verified');
}

// ── 4. invoices insurance + facility columns ──────────────────────────────────
async function ensureInvoiceColumns() {
  const cols = [
    "ALTER TABLE invoices ADD COLUMN insurance_provider       TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_policy_number  TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_number   TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_status   TEXT DEFAULT 'None'",
    "ALTER TABLE invoices ADD COLUMN facility_id              INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ invoices columns verified');
}

// ── 5. patients encryption + facility columns ─────────────────────────────────
async function ensurePatientColumns() {
  const cols = [
    "ALTER TABLE patients ADD COLUMN phone_hash              TEXT",
    "ALTER TABLE patients ADD COLUMN email_hash              TEXT",
    "ALTER TABLE patients ADD COLUMN nin_hash                TEXT",
    "ALTER TABLE patients ADD COLUMN insurance_group_number  TEXT",
    "ALTER TABLE patients ADD COLUMN facility_id             INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ patients columns verified');
}

// ── 6. users encryption + facility columns ────────────────────────────────────
async function ensureUserColumns() {
  const cols = [
    "ALTER TABLE users ADD COLUMN phone_hash   TEXT",
    "ALTER TABLE users ADD COLUMN facility_id  INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ users columns verified');
}

// ── 7. consultations ICD-10 + facility columns ────────────────────────────────
async function ensureConsultationColumns() {
  const cols = [
    "ALTER TABLE consultations ADD COLUMN icd_codes            TEXT",
    "ALTER TABLE consultations ADD COLUMN primary_icd_code     TEXT",
    "ALTER TABLE consultations ADD COLUMN secondary_icd_codes  TEXT",
    "ALTER TABLE consultations ADD COLUMN facility_id          INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ consultations columns verified');
}

// ── 8. lab_orders + lab_results facility columns ──────────────────────────────
async function ensureLabColumns() {
  const cols = [
    "ALTER TABLE lab_orders   ADD COLUMN facility_id INTEGER",
    "ALTER TABLE lab_results  ADD COLUMN facility_id INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ lab columns verified');
}

// ── 9. audit_logs table (full audit trail) ────────────────────────────────────
async function ensureAuditLogsTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER REFERENCES users(user_id),
      user_role      TEXT,
      full_name      TEXT,
      action         TEXT NOT NULL,
      resource_type  TEXT,
      resource_id    TEXT,
      http_method    TEXT,
      endpoint       TEXT,
      status_code    INTEGER,
      ip_address     TEXT,
      user_agent     TEXT,
      changes_before TEXT,
      changes_after  TEXT,
      description    TEXT,
      session_id     TEXT,
      facility_id    INTEGER,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_logs(user_id)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs(action)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_audit_facility ON audit_logs(facility_id)');
  console.log('✅ audit_logs table verified');
}

// ── 10. ICD-10 codes table ────────────────────────────────────────────────────
async function ensureIcd10Table() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS icd10_codes (
      code        TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category    TEXT NOT NULL,
      chapter     TEXT,
      is_active   INTEGER DEFAULT 1
    )
  `);
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_icd_cat  ON icd10_codes(category)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_icd_desc ON icd10_codes(description)');
  console.log('✅ icd10_codes table verified');
}

// ── 11. Facilities table (multi-facility) ─────────────────────────────────────
async function ensureFacilitiesTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS facilities (
      facility_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL,
      facility_type     TEXT DEFAULT 'Clinic',
      address           TEXT,
      state             TEXT DEFAULT 'Lagos',
      lga               TEXT,
      phone             TEXT,
      email             TEXT,
      rc_number         TEXT,
      lashma_id         TEXT,
      license_number    TEXT,
      logo_url          TEXT,
      primary_color     TEXT DEFAULT '#0F6E56',
      timezone          TEXT DEFAULT 'Africa/Lagos',
      currency          TEXT DEFAULT 'NGN',
      subscription_plan TEXT DEFAULT 'starter',
      is_active         INTEGER DEFAULT 1,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure default facility 1 always exists
  const clinicName = process.env.CLINIC_NAME || 'CliniCore Healthcare';
  await safeRun(
    `INSERT OR IGNORE INTO facilities (facility_id, name, state) VALUES (1, ?, 'Lagos')`,
    [clinicName]
  );

  // Index on facility_id for all major tables
  const facilityIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_facility         ON users(facility_id)',
    'CREATE INDEX IF NOT EXISTS idx_patients_facility      ON patients(facility_id)',
    'CREATE INDEX IF NOT EXISTS idx_patients_phone_hash    ON patients(phone_hash)',
    'CREATE INDEX IF NOT EXISTS idx_patients_email_hash    ON patients(email_hash)',
    'CREATE INDEX IF NOT EXISTS idx_appointments_facility  ON appointments(facility_id)',
    'CREATE INDEX IF NOT EXISTS idx_consultations_facility ON consultations(facility_id)',
    'CREATE INDEX IF NOT EXISTS idx_lab_orders_facility    ON lab_orders(facility_id)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_facility      ON invoices(facility_id)',
  ];
  for (const sql of facilityIndexes) await safeCreate(sql);

  // Backfill facility_id = 1 for any existing records
  const backfillTables = [
    'UPDATE users         SET facility_id = 1 WHERE facility_id IS NULL',
    'UPDATE patients      SET facility_id = 1 WHERE facility_id IS NULL',
    'UPDATE appointments  SET facility_id = 1 WHERE facility_id IS NULL',
    'UPDATE consultations SET facility_id = 1 WHERE facility_id IS NULL',
    'UPDATE lab_orders    SET facility_id = 1 WHERE facility_id IS NULL',
    'UPDATE invoices      SET facility_id = 1 WHERE facility_id IS NULL',
  ];
  for (const sql of backfillTables) await safeRun(sql);

  console.log('✅ facilities table + multi-facility columns verified');
}

// ── 12. Supply chain tables ───────────────────────────────────────────────────
async function ensureSupplyChainTables() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      contact_person TEXT,
      phone          TEXT,
      email          TEXT,
      address        TEXT,
      supplier_type  TEXT DEFAULT 'Drug',
      payment_terms  TEXT DEFAULT 'Net 30',
      rating         INTEGER DEFAULT 3,
      tax_id         TEXT,
      bank_name      TEXT,
      bank_account   TEXT,
      notes          TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      po_id           INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number       TEXT NOT NULL UNIQUE,
      supplier_id     INTEGER REFERENCES suppliers(supplier_id),
      facility_id     INTEGER,
      status          TEXT NOT NULL DEFAULT 'Draft',
      order_date      DATE NOT NULL DEFAULT (date('now')),
      expected_date   DATE,
      received_date   DATE,
      subtotal        REAL DEFAULT 0,
      tax_amount      REAL DEFAULT 0,
      discount        REAL DEFAULT 0,
      total_amount    REAL DEFAULT 0,
      amount_paid     REAL DEFAULT 0,
      payment_status  TEXT DEFAULT 'Unpaid',
      delivery_address TEXT,
      notes           TEXT,
      approved_by     INTEGER,
      approved_at     DATETIME,
      created_by      INTEGER,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS po_items (
      po_item_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id            INTEGER REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
      medication_id    INTEGER,
      item_name        TEXT NOT NULL,
      quantity_ordered INTEGER DEFAULT 1,
      quantity_received INTEGER DEFAULT 0,
      unit_cost        REAL DEFAULT 0,
      total_cost       REAL DEFAULT 0,
      unit             TEXT,
      notes            TEXT
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS goods_received (
      grn_id         INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_number     TEXT NOT NULL UNIQUE,
      po_id          INTEGER,
      supplier_id    INTEGER,
      received_date  DATE DEFAULT (date('now')),
      invoice_number TEXT,
      invoice_date   DATE,
      invoice_amount REAL,
      status         TEXT DEFAULT 'Complete',
      notes          TEXT,
      received_by    INTEGER,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS grn_items (
      grn_item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id           INTEGER REFERENCES goods_received(grn_id) ON DELETE CASCADE,
      po_item_id       INTEGER,
      medication_id    INTEGER,
      item_name        TEXT NOT NULL,
      quantity_received INTEGER DEFAULT 0,
      unit_cost        REAL DEFAULT 0,
      batch_number     TEXT,
      expiry_date      DATE,
      storage_location TEXT,
      condition        TEXT DEFAULT 'Good'
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      movement_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id  INTEGER NOT NULL,
      movement_type  TEXT NOT NULL,
      quantity       INTEGER NOT NULL,
      quantity_before INTEGER DEFAULT 0,
      quantity_after  INTEGER DEFAULT 0,
      reference_type TEXT,
      reference_id   INTEGER,
      batch_number   TEXT,
      expiry_date    DATE,
      unit_cost      REAL,
      notes          TEXT,
      created_by     INTEGER,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ supply chain tables verified');
}

// ── 13. Staff scheduling tables ───────────────────────────────────────────────
async function ensureSchedulingTables() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS shift_templates (
      template_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      shift_type     TEXT NOT NULL DEFAULT 'Morning',
      start_time     TEXT NOT NULL,
      end_time       TEXT NOT NULL,
      duration_hours REAL,
      department     TEXT,
      color          TEXT DEFAULT '#0F6E56',
      description    TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS staff_schedules (
      schedule_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      template_id    INTEGER,
      schedule_date  DATE NOT NULL,
      shift_type     TEXT NOT NULL DEFAULT 'Morning',
      start_time     TEXT,
      end_time       TEXT,
      department     TEXT,
      location       TEXT,
      status         TEXT NOT NULL DEFAULT 'Scheduled',
      notes          TEXT,
      check_in_time  DATETIME,
      check_out_time DATETIME,
      facility_id    INTEGER,
      created_by     INTEGER,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS shift_swaps (
      swap_id                INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id           INTEGER NOT NULL,
      target_id              INTEGER NOT NULL,
      requester_schedule_id  INTEGER,
      target_schedule_id     INTEGER,
      swap_date              DATE NOT NULL,
      reason                 TEXT,
      status                 TEXT NOT NULL DEFAULT 'Pending',
      reviewed_by            INTEGER,
      reviewed_at            DATETIME,
      review_notes           TEXT,
      created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      leave_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      leave_type   TEXT NOT NULL DEFAULT 'Annual',
      start_date   DATE NOT NULL,
      end_date     DATE NOT NULL,
      days_count   INTEGER DEFAULT 1,
      reason       TEXT,
      status       TEXT NOT NULL DEFAULT 'Pending',
      reviewed_by  INTEGER,
      reviewed_at  DATETIME,
      review_notes TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default shift templates if none exist
  const count = await new Promise(resolve =>
    db.get('SELECT COUNT(*) AS n FROM shift_templates', (_, r) => resolve(r?.n || 0))
  );
  if (!count) {
    const templates = [
      ['Morning Shift',   'Morning',   '07:00', '15:00', 8,   '#0F6E56'],
      ['Afternoon Shift', 'Afternoon', '15:00', '23:00', 8,   '#185FA5'],
      ['Night Shift',     'Night',     '23:00', '07:00', 8,   '#534AB7'],
      ['On-Call',         'On-call',   '08:00', '20:00', 12,  '#BA7517'],
    ];
    for (const [name, type, start, end, hrs, color] of templates) {
      await safeRun(
        `INSERT OR IGNORE INTO shift_templates (name, shift_type, start_time, end_time, duration_hours, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, type, start, end, hrs, color]
      );
    }
  }
  console.log('✅ scheduling tables verified');
}

// ── 14. Bed management tables ─────────────────────────────────────────────────
async function ensureBedTables() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS wards (
      ward_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      ward_type   TEXT DEFAULT 'General',
      floor       INTEGER DEFAULT 1,
      capacity    INTEGER DEFAULT 10,
      facility_id INTEGER,
      is_active   INTEGER DEFAULT 1,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS beds (
      bed_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      bed_number  TEXT NOT NULL,
      ward_id     INTEGER REFERENCES wards(ward_id),
      bed_type    TEXT DEFAULT 'Standard',
      status      TEXT DEFAULT 'Available',
      facility_id INTEGER,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS bed_admissions (
      admission_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER NOT NULL,
      bed_id          INTEGER REFERENCES beds(bed_id),
      ward_id         INTEGER REFERENCES wards(ward_id),
      admission_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
      discharge_date  DATETIME,
      diagnosis       TEXT,
      status          TEXT DEFAULT 'Active',
      notes           TEXT,
      admitted_by     INTEGER,
      facility_id     INTEGER,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ bed management tables verified');
}

// ── 15. Medical imaging table ─────────────────────────────────────────────────
async function ensureImagingTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS medical_images (
      image_id        INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER NOT NULL,
      ordered_by      INTEGER,
      image_type      TEXT NOT NULL DEFAULT 'X-Ray',
      body_part       TEXT,
      description     TEXT,
      cloudinary_url  TEXT,
      cloudinary_id   TEXT,
      thumbnail_url   TEXT,
      file_size       INTEGER,
      ai_analysis     TEXT,
      radiologist_notes TEXT,
      status          TEXT DEFAULT 'Pending',
      facility_id     INTEGER,
      taken_at        DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ medical_images table verified');
}

// ── 16. Maternity + insurance columns (facility) ──────────────────────────────
async function ensureMaternityInsuranceColumns() {
  const cols = [
    "ALTER TABLE maternity_cases   ADD COLUMN facility_id INTEGER",
    "ALTER TABLE insurance_claims  ADD COLUMN facility_id INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ maternity + insurance facility columns verified');
}

// ── 17. Symptom checker log table ─────────────────────────────────────────────
async function ensureSymptomCheckerTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS symptom_checker_log (
      log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      patient_id  INTEGER,
      symptoms    TEXT,
      assessment  TEXT,
      severity    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ symptom_checker_log table verified');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTO-INITIALIZE
// ═══════════════════════════════════════════════════════════════════════════════
export async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();

    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization');
    } else {
      console.log('🔧 Database tables not found - initializing...');
      const initScriptPath = path.join(__dirname, 'init_SIMPLE.js');
      if (!fs.existsSync(initScriptPath)) {
        throw new Error('init_SIMPLE.js not found at ' + initScriptPath);
      }
      const { initializeDatabase } = await import('./init_SIMPLE.js');
      await initializeDatabase();
      console.log('✅ Database auto-initialized successfully!');
    }

    // ── Run all migrations on every startup (all idempotent) ─────────────────
    await ensureInventoryColumns();
    await ensureActivityLogsColumns();
    await ensureAppointmentColumns();
    await ensureInvoiceColumns();
    await ensurePatientColumns();
    await ensureUserColumns();
    await ensureConsultationColumns();
    await ensureLabColumns();
    await ensureAuditLogsTable();
    await ensureIcd10Table();
    await ensureFacilitiesTable();       // ← includes facility backfill
    await ensureSupplyChainTables();
    await ensureSchedulingTables();
    await ensureBedTables();
    await ensureImagingTable();
    await ensureMaternityInsuranceColumns();
    await ensureSymptomCheckerTable();

    return true;
  } catch (err) {
    console.error('❌ Database auto-initialization failed:', err.message);
    return false;
  }
}

export async function initDatabaseOnStartup() {
  console.log('🔍 Checking database status...');
  try {
    const initialized = await autoInitializeDatabase();
    if (initialized) {
      console.log('✅ Database ready for use');
      return true;
    } else {
      console.log('⚠️  Database check completed with warnings');
      return false;
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    return false;
  }
}

async function ensureVisitsTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS visits (
      visit_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id        INTEGER NOT NULL,
      visit_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
      visit_type        TEXT NOT NULL DEFAULT 'Outpatient',
      status            TEXT NOT NULL DEFAULT 'Registered',
      chief_complaint   TEXT,
      triage_priority   TEXT DEFAULT 'Normal',
      registered_by     INTEGER,
      nurse_id          INTEGER,
      doctor_id         INTEGER,
      appointment_id    INTEGER,
      admission_id      INTEGER,
      discharge_date    DATETIME,
      discharge_summary TEXT,
      discharge_type    TEXT,
      follow_up_date    DATE,
      facility_id       INTEGER,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_visits_patient  ON visits(patient_id)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_visits_status   ON visits(status)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_visits_date     ON visits(visit_date)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_visits_doctor   ON visits(doctor_id)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_visits_facility ON visits(facility_id)');
 
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS visit_status_log (
      log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id    INTEGER NOT NULL,
      from_status TEXT,
      to_status   TEXT NOT NULL,
      changed_by  INTEGER,
      notes       TEXT,
      changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_vsl_visit ON visit_status_log(visit_id)');
  console.log('✅ visits + visit_status_log tables verified');
}
 
async function ensureVitalsTable() {
  await safeCreate(`
    CREATE TABLE IF NOT EXISTS vitals (
      vital_id             INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id             INTEGER NOT NULL,
      patient_id           INTEGER NOT NULL,
      blood_pressure_sys   INTEGER,
      blood_pressure_dia   INTEGER,
      pulse_rate           INTEGER,
      temperature          REAL,
      respiratory_rate     INTEGER,
      oxygen_saturation    REAL,
      weight               REAL,
      height               REAL,
      bmi                  REAL,
      blood_glucose        REAL,
      pain_score           INTEGER,
      general_appearance   TEXT,
      notes                TEXT,
      recorded_by          INTEGER,
      recorded_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      facility_id          INTEGER
    )
  `);
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_vitals_visit   ON vitals(visit_id)');
  await safeCreate('CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id)');
  console.log('✅ vitals table verified');
}
 
async function ensureVisitColumns() {
  // Add visit_id to all clinical tables
  const cols = [
    'ALTER TABLE consultations  ADD COLUMN visit_id INTEGER',
    'ALTER TABLE lab_orders     ADD COLUMN visit_id INTEGER',
    'ALTER TABLE lab_results    ADD COLUMN visit_id INTEGER',
    'ALTER TABLE invoices       ADD COLUMN visit_id INTEGER',
    'ALTER TABLE medications    ADD COLUMN visit_id INTEGER',
    'ALTER TABLE appointments   ADD COLUMN visit_id INTEGER',
    'ALTER TABLE bed_admissions ADD COLUMN visit_id INTEGER',
    'ALTER TABLE medical_images ADD COLUMN visit_id INTEGER',
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ visit_id columns verified on clinical tables');
}

async function ensureAuditLogsColumns() {
  // Add user_role column if missing — was in some controller inserts but not schema
  await safeAlter('ALTER TABLE audit_logs ADD COLUMN user_role TEXT');
  await safeAlter('ALTER TABLE audit_logs ADD COLUMN ip_address TEXT');
  await safeAlter('ALTER TABLE audit_logs ADD COLUMN user_agent TEXT');
  console.log('✅ audit_logs columns verified');
}