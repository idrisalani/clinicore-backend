// ============================================
// phase_a_migration.mjs
// Run: node phase_a_migration.mjs  (from backend/)
//
// Phase A: Clinical workflow database foundation
// 1. visits table       — episode tying everything together
// 2. vitals table       — nurse vital signs per visit
// 3. visit_id columns   — on consultations, lab_orders, invoices, medications
// 4. patient_timeline   — SQL view for doctor's full history
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

import db from './src/config/database.js';

const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);
const safe = async (sql) => {
  try { await run(sql); }
  catch (e) {
    if (!e.message.includes('already exists') && !e.message.includes('duplicate column'))
      console.warn('  ⚠️ ', e.message.split('\n')[0]);
  }
};

console.log('\n🏥 Phase A: Clinical workflow schema\n');

// ── 1. visits table ───────────────────────────────────────────────────────────
await safe(`
  CREATE TABLE IF NOT EXISTS visits (
    visit_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id        INTEGER NOT NULL REFERENCES patients(patient_id),
    visit_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_type        TEXT NOT NULL DEFAULT 'Outpatient'
                      CHECK(visit_type IN ('Outpatient','Inpatient','Emergency','Follow-up')),
    status            TEXT NOT NULL DEFAULT 'Registered'
                      CHECK(status IN (
                        'Registered','Waiting','With Nurse','With Doctor',
                        'Awaiting Lab','Awaiting Imaging','Awaiting Pharmacy',
                        'Admitted','Discharged','Cancelled'
                      )),
    chief_complaint   TEXT,
    triage_priority   TEXT DEFAULT 'Normal'
                      CHECK(triage_priority IN ('Emergency','Urgent','Normal')),
    registered_by     INTEGER REFERENCES users(user_id),
    nurse_id          INTEGER REFERENCES users(user_id),
    doctor_id         INTEGER REFERENCES users(user_id),
    appointment_id    INTEGER,
    admission_id      INTEGER,
    discharge_date    DATETIME,
    discharge_summary TEXT,
    discharge_type    TEXT CHECK(discharge_type IN ('Home','Referred','Admitted','AMA',NULL)),
    follow_up_date    DATE,
    facility_id       INTEGER,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
await safe('CREATE INDEX IF NOT EXISTS idx_visits_patient    ON visits(patient_id)');
await safe('CREATE INDEX IF NOT EXISTS idx_visits_status     ON visits(status)');
await safe('CREATE INDEX IF NOT EXISTS idx_visits_date       ON visits(visit_date)');
await safe('CREATE INDEX IF NOT EXISTS idx_visits_doctor     ON visits(doctor_id)');
await safe('CREATE INDEX IF NOT EXISTS idx_visits_facility   ON visits(facility_id)');
console.log('  ✅ visits table');

// ── 2. vitals table ───────────────────────────────────────────────────────────
await safe(`
  CREATE TABLE IF NOT EXISTS vitals (
    vital_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id             INTEGER NOT NULL REFERENCES visits(visit_id),
    patient_id           INTEGER NOT NULL REFERENCES patients(patient_id),
    blood_pressure_sys   INTEGER,          -- systolic mmHg
    blood_pressure_dia   INTEGER,          -- diastolic mmHg
    pulse_rate           INTEGER,          -- bpm
    temperature          REAL,             -- °C
    respiratory_rate     INTEGER,          -- breaths/min
    oxygen_saturation    REAL,             -- SpO₂ %
    weight               REAL,             -- kg
    height               REAL,             -- cm
    bmi                  REAL,             -- auto-computed
    blood_glucose        REAL,             -- mmol/L
    pain_score           INTEGER,          -- 0-10
    general_appearance   TEXT,
    notes                TEXT,
    recorded_by          INTEGER REFERENCES users(user_id),
    recorded_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    facility_id          INTEGER
  )
`);
await safe('CREATE INDEX IF NOT EXISTS idx_vitals_visit   ON vitals(visit_id)');
await safe('CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id)');
console.log('  ✅ vitals table');

// ── 3. Add visit_id to clinical tables ────────────────────────────────────────
const clinicalCols = [
  'ALTER TABLE consultations  ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE lab_orders     ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE lab_results    ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE invoices       ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE medications    ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE appointments   ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE bed_admissions ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
  'ALTER TABLE medical_images ADD COLUMN visit_id INTEGER REFERENCES visits(visit_id)',
];
let colsAdded = 0;
for (const sql of clinicalCols) { await safe(sql); colsAdded++; }
console.log(`  ✅ visit_id added to ${colsAdded} clinical tables`);

// ── 4. visit status history table ─────────────────────────────────────────────
await safe(`
  CREATE TABLE IF NOT EXISTS visit_status_log (
    log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id    INTEGER NOT NULL REFERENCES visits(visit_id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  INTEGER REFERENCES users(user_id),
    notes       TEXT,
    changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
await safe('CREATE INDEX IF NOT EXISTS idx_vsl_visit ON visit_status_log(visit_id)');
console.log('  ✅ visit_status_log table');

// ── 5. patient_timeline view ──────────────────────────────────────────────────
// Drop and recreate to ensure latest definition
await run('DROP VIEW IF EXISTS patient_timeline').catch(() => {});
await safe(`
  CREATE VIEW IF NOT EXISTS patient_timeline AS

  -- Visits (episode headers)
  SELECT
    'visit'           AS record_type,
    v.visit_id        AS record_id,
    v.patient_id,
    v.visit_date      AS event_date,
    v.visit_type      AS category,
    v.status          AS sub_category,
    v.chief_complaint AS title,
    v.discharge_summary AS detail,
    v.doctor_id       AS provider_id,
    v.facility_id
  FROM visits v

  UNION ALL

  -- Vital signs
  SELECT
    'vitals'          AS record_type,
    vt.vital_id       AS record_id,
    vt.patient_id,
    vt.recorded_at    AS event_date,
    'Vitals'          AS category,
    NULL              AS sub_category,
    'Vital Signs Recorded' AS title,
    (
      COALESCE('BP: '||vt.blood_pressure_sys||'/'||vt.blood_pressure_dia||' mmHg  ','') ||
      COALESCE('Temp: '||vt.temperature||'°C  ','') ||
      COALESCE('Pulse: '||vt.pulse_rate||' bpm  ','') ||
      COALESCE('SpO₂: '||vt.oxygen_saturation||'%  ','') ||
      COALESCE('Weight: '||vt.weight||' kg','')
    )                 AS detail,
    vt.recorded_by    AS provider_id,
    vt.facility_id
  FROM vitals vt

  UNION ALL

  -- Consultations
  SELECT
    'consultation'    AS record_type,
    c.consultation_id AS record_id,
    c.patient_id,
    c.consultation_date AS event_date,
    'Consultation'    AS category,
    c.status          AS sub_category,
    c.chief_complaint AS title,
    c.diagnosis       AS detail,
    c.doctor_id       AS provider_id,
    c.facility_id
  FROM consultations c

  UNION ALL

  -- Lab orders
  SELECT
    'lab_order'       AS record_type,
    lo.lab_order_id   AS record_id,
    lo.patient_id,
    lo.ordered_date   AS event_date,
    'Laboratory'      AS category,
    lo.status         AS sub_category,
    lo.test_name      AS title,
    lo.clinical_notes AS detail,
    lo.ordered_by     AS provider_id,
    lo.facility_id
  FROM lab_orders lo

  UNION ALL

  -- Lab results
  SELECT
    'lab_result'      AS record_type,
    lr.result_id      AS record_id,
    lo2.patient_id,
    lr.result_date    AS event_date,
    'Lab Result'      AS category,
    lr.status         AS sub_category,
    lo2.test_name     AS title,
    lr.result_value   AS detail,
    lr.reviewed_by    AS provider_id,
    lo2.facility_id
  FROM lab_results lr
  JOIN lab_orders lo2 ON lr.lab_order_id = lo2.lab_order_id

  UNION ALL

  -- Medical images
  SELECT
    'imaging'         AS record_type,
    mi.image_id       AS record_id,
    mi.patient_id,
    mi.taken_at       AS event_date,
    'Imaging'         AS category,
    mi.image_type     AS sub_category,
    mi.body_part      AS title,
    mi.radiologist_notes AS detail,
    mi.ordered_by     AS provider_id,
    mi.facility_id
  FROM medical_images mi

  UNION ALL

  -- Invoices
  SELECT
    'invoice'         AS record_type,
    i.invoice_id      AS record_id,
    i.patient_id,
    i.invoice_date    AS event_date,
    'Finance'         AS category,
    i.payment_status  AS sub_category,
    'Invoice #'||i.invoice_number AS title,
    'Total: ₦'||i.total_amount   AS detail,
    i.created_by      AS provider_id,
    i.facility_id
  FROM invoices i

  ORDER BY event_date DESC
`);
console.log('  ✅ patient_timeline view');

// ── 6. Verify ─────────────────────────────────────────────────────────────────
const tables = await new Promise((res, rej) =>
  db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN
    ('visits','vitals','visit_status_log')`, (e, r) => e ? rej(e) : res(r || []))
);
const views = await new Promise((res, rej) =>
  db.all(`SELECT name FROM sqlite_master WHERE type='view' AND name='patient_timeline'`,
    (e, r) => e ? rej(e) : res(r || []))
);
console.log(`\n  Tables created: ${tables.map(t => t.name).join(', ')}`);
console.log(`  Views created: ${views.map(v => v.name).join(', ')}`);
console.log('\n🎉 Phase A complete!\n');
console.log('  Next steps:');
console.log('  • Add these tables to autoInit.js');
console.log('  • Build visitController.js + vitalsController.js (Phase B)');
console.log('  • Convert PatientForm to 2-step wizard (Phase C)\n');

process.exit(0);