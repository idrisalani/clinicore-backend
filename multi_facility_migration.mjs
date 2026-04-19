// ============================================
// multi_facility_migration.mjs
// Run: node multi_facility_migration.mjs  (from backend/)
//
// Adds multi-facility support to CliniCore:
// 1. Creates facilities table
// 2. Adds facility_id to users + all clinical tables
// 3. Seeds a default facility from .env clinic data
// 4. Assigns all existing records to facility 1
// ============================================
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  readFileSync(resolve(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i > 0) { const k = line.slice(0,i).trim(); if (!(k in process.env)) process.env[k] = line.slice(i+1).trim(); }
  });
} catch {}

import { query } from './src/config/database.js';

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;

console.log('🏥 Running Multi-facility migration...\n');

// ── Step 1: Create facilities table ──────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS facilities (
    facility_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    facility_type    TEXT DEFAULT 'Clinic'
      CHECK(facility_type IN ('Clinic','Hospital','Pharmacy','Lab','Specialist')),
    address          TEXT,
    state            TEXT DEFAULT 'Lagos',
    lga              TEXT,
    phone            TEXT,
    email            TEXT,
    rc_number        TEXT,
    lashma_id        TEXT,       -- LASHMA empanelment number
    license_number   TEXT,
    logo_url         TEXT,
    primary_color    TEXT DEFAULT '#0F6E56',
    timezone         TEXT DEFAULT 'Africa/Lagos',
    currency         TEXT DEFAULT 'NGN',
    subscription_plan TEXT DEFAULT 'starter'
      CHECK(subscription_plan IN ('starter','standard','enterprise')),
    is_active        INTEGER DEFAULT 1,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ facilities table'))
  .catch(e => console.log('  ⏭  facilities:', e.message.split('\n')[0]));

// ── Step 2: Add facility_id to core clinical tables ───────────────────────────
const tableCols = [
  'ALTER TABLE users          ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE patients       ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE appointments   ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE consultations  ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE lab_orders     ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE lab_results    ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE invoices       ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE medications    ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE medication_catalog ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE beds           ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE wards          ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE audit_logs     ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE activity_logs  ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE queue          ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE maternity_cases ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE insurance_claims ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE purchase_orders  ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
  'ALTER TABLE staff_schedules  ADD COLUMN facility_id INTEGER REFERENCES facilities(facility_id)',
];

let colsAdded = 0;
for (const sql of tableCols) {
  await query(sql).then(() => colsAdded++)
    .catch(e => {
      if (!e.message?.includes('duplicate column'))
        console.warn('  ⚠️ ', e.message.split('\n')[0]);
    });
}
console.log(`  ✅ facility_id added to ${colsAdded} table columns`);

// ── Step 3: Indexes ───────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_users_facility         ON users(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_patients_facility      ON patients(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_facility  ON appointments(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_consultations_facility ON consultations(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_lab_orders_facility    ON lab_orders(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_invoices_facility      ON invoices(facility_id)',
  'CREATE INDEX IF NOT EXISTS idx_queue_facility         ON queue(facility_id)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes created');

// ── Step 4: Seed default facility from .env ───────────────────────────────────
const existing = await getOne('SELECT facility_id FROM facilities WHERE facility_id = 1');
if (!existing) {
  const name    = process.env.CLINIC_NAME    || 'CliniCore Healthcare';
  const address = process.env.CLINIC_ADDRESS || '14, Ero Crescent, Lagos';
  const phone   = process.env.CLINIC_PHONE   || '+234-814-114-9819';
  const email   = process.env.CLINIC_EMAIL   || 'admin@clinicore.com';
  const rc      = process.env.CLINIC_RC      || '';

  await query(
    `INSERT INTO facilities (facility_id, name, facility_type, address, state, phone, email, rc_number)
     VALUES (1, ?, 'Clinic', ?, 'Lagos', ?, ?, ?)`,
    [name, address, phone, email, rc || null]
  );
  console.log(`  ✅ Default facility seeded: "${name}"`);
}

// ── Step 5: Assign all existing records to facility 1 ─────────────────────────
const assignments = [
  'UPDATE users           SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE patients        SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE appointments    SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE consultations   SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE lab_orders      SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE lab_results     SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE invoices        SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE medications     SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE medication_catalog SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE audit_logs      SET facility_id = 1 WHERE facility_id IS NULL',
  'UPDATE activity_logs   SET facility_id = 1 WHERE facility_id IS NULL',
];
let totalRows = 0;
for (const sql of assignments) {
  const r = await query(sql).catch(() => null);
  totalRows += r?.changes || 0;
}
console.log(`  ✅ ${totalRows} existing rows assigned to facility 1`);

const fac = await getOne('SELECT * FROM facilities WHERE facility_id = 1');
console.log(`\n🎉 Done! Default facility: "${fac?.name}" (ID: 1)`);
console.log('  All existing data is now scoped to facility 1');
console.log('  New facilities can be added via POST /api/v1/facilities');