// ============================================
// bed_management_migration.mjs
// Run: node bed_management_migration.mjs  (from backend/)
// ============================================
import { query } from './src/config/database.js';

console.log('🛏️  Running Bed Management migration...\n');

// ── wards ─────────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS wards (
    ward_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE,
    ward_type     TEXT NOT NULL DEFAULT 'General'
      CHECK(ward_type IN ('General','ICU','Maternity','Paediatrics',
                          'Surgical','Medical','Private','Isolation','Emergency')),
    floor         TEXT,
    total_beds    INTEGER NOT NULL DEFAULT 0,
    description   TEXT,
    head_nurse_id INTEGER REFERENCES users(user_id),
    is_active     INTEGER DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ wards'))
  .catch(e => console.log('  ⏭  wards:', e.message.split('\n')[0]));

// ── beds ──────────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS beds (
    bed_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id       INTEGER NOT NULL REFERENCES wards(ward_id),
    bed_number    TEXT NOT NULL,
    bed_type      TEXT DEFAULT 'Standard'
      CHECK(bed_type IN ('Standard','ICU','Maternity','Paediatric',
                         'Isolation','Private','HDU')),
    status        TEXT DEFAULT 'Available'
      CHECK(status IN ('Available','Occupied','Reserved',
                       'Maintenance','Cleaning')),
    features      TEXT,    -- e.g. "Oxygen, Call bell, IV pole"
    notes         TEXT,
    is_active     INTEGER DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ward_id, bed_number)
  )
`).then(() => console.log('  ✅ beds'))
  .catch(e => console.log('  ⏭  beds:', e.message.split('\n')[0]));

// ── bed_admissions ────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS bed_admissions (
    admission_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id             INTEGER NOT NULL REFERENCES beds(bed_id),
    ward_id            INTEGER NOT NULL REFERENCES wards(ward_id),
    patient_id         INTEGER NOT NULL REFERENCES patients(patient_id),
    consultation_id    INTEGER REFERENCES consultations(consultation_id),
    admitting_doctor_id INTEGER REFERENCES users(user_id),

    -- Admission details
    admission_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_discharge DATE,
    actual_discharge   DATETIME,
    admission_type     TEXT DEFAULT 'Elective'
      CHECK(admission_type IN ('Emergency','Elective','Transfer','Maternity')),
    admission_reason   TEXT NOT NULL,
    diagnosis          TEXT,

    -- Status
    status             TEXT DEFAULT 'Active'
      CHECK(status IN ('Active','Discharged','Transferred','Deceased')),
    discharge_notes    TEXT,
    discharge_type     TEXT
      CHECK(discharge_type IN ('Recovered','Transferred','AMA','Deceased',NULL)),

    -- Admin
    admitted_by        INTEGER REFERENCES users(user_id),
    discharged_by      INTEGER REFERENCES users(user_id),
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ bed_admissions'))
  .catch(e => console.log('  ⏭  bed_admissions:', e.message.split('\n')[0]));

// ── indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_beds_ward        ON beds(ward_id)',
  'CREATE INDEX IF NOT EXISTS idx_beds_status      ON beds(status)',
  'CREATE INDEX IF NOT EXISTS idx_adm_patient      ON bed_admissions(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_adm_bed          ON bed_admissions(bed_id)',
  'CREATE INDEX IF NOT EXISTS idx_adm_status       ON bed_admissions(status)',
  'CREATE INDEX IF NOT EXISTS idx_adm_admit_date   ON bed_admissions(admission_date)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

// ── seed starter wards ────────────────────────────────────────────────────────
const seedWards = [
  ['General Ward A',  'General',    'Ground Floor', 20],
  ['General Ward B',  'General',    'Ground Floor', 20],
  ['Maternity Ward',  'Maternity',  'First Floor',  10],
  ['Children Ward',   'Paediatrics','First Floor',  10],
  ['ICU',             'ICU',        'Second Floor',  6],
  ['Private Ward',    'Private',    'Second Floor',  8],
];
for (const [name, type, floor, total] of seedWards) {
  await query(
    `INSERT OR IGNORE INTO wards (name, ward_type, floor, total_beds) VALUES (?,?,?,?)`,
    [name, type, floor, total]
  );
}
console.log('  ✅ Starter wards seeded');

const r = await query('SELECT COUNT(*) as c FROM wards');
const b = await query('SELECT COUNT(*) as c FROM beds');
console.log(`\n🎉 Done! Wards: ${r.rows[0]?.c} · Beds: ${b.rows[0]?.c}`);
console.log('   Next: add beds via the UI or run seed_beds.mjs');