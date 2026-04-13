// ============================================
// maternity_migration.mjs
// Run once: node maternity_migration.mjs
// from backend/ folder
//
// Matches maternityController.js exactly.
// Safe to re-run — uses IF NOT EXISTS + duplicate column guards.
// ============================================
import { query } from './src/config/database.js';

console.log('🤱 Running Maternity Module migration...\n');

// ── maternity_cases ───────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS maternity_cases (
    case_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id             INTEGER NOT NULL REFERENCES patients(patient_id),

    -- Pregnancy dating
    lmp_date               DATE,
    edd                    DATE,
    edd_by_scan            DATE,
    gestational_age_weeks  INTEGER,
    booking_date           DATE,

    -- Obstetric history
    gravida                INTEGER DEFAULT 1,
    parity                 INTEGER DEFAULT 0,
    previous_cs            INTEGER DEFAULT 0,
    previous_miscarriages  INTEGER DEFAULT 0,
    previous_stillbirths   INTEGER DEFAULT 0,

    -- Serology / labs
    blood_group            TEXT,
    rhesus_factor          TEXT,
    hiv_status             TEXT DEFAULT 'Unknown',
    hb_at_booking          REAL,

    -- Risk
    risk_level             TEXT DEFAULT 'Low'
      CHECK(risk_level IN ('Low','Moderate','High','Very High')),
    risk_factors           TEXT,

    -- Status & outcome
    status                 TEXT DEFAULT 'Active'
      CHECK(status IN ('Active','Delivered','Closed','Transferred','Lost to Follow-up','Deceased')),
    outcome                TEXT,
    anc_count              INTEGER DEFAULT 0,

    -- Admin
    notes                  TEXT,
    created_by             INTEGER REFERENCES users(user_id),
    updated_by             INTEGER REFERENCES users(user_id),
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ maternity_cases'))
  .catch(e => console.log('  ⏭  maternity_cases:', e.message.split('\n')[0]));

// ── anc_visits ────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS anc_visits (
    visit_id               INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id                INTEGER NOT NULL REFERENCES maternity_cases(case_id),
    patient_id             INTEGER NOT NULL REFERENCES patients(patient_id),

    visit_date             DATE NOT NULL,
    gestational_week       INTEGER,
    visit_type             TEXT DEFAULT 'Routine'
      CHECK(visit_type IN ('Routine','Emergency','Follow-up','Booking','Postnatal')),

    -- Maternal vitals
    weight_kg              REAL,
    bp_systolic            INTEGER,
    bp_diastolic           INTEGER,
    temperature_c          REAL,
    pulse_bpm              INTEGER,
    haemoglobin            REAL,

    -- Obstetric exam
    fundal_height_cm       REAL,
    fetal_presentation     TEXT,
    fetal_heart_rate       INTEGER,
    fetal_movement         TEXT,
    lie                    TEXT,
    engagement             TEXT,

    -- Urine / oedema
    urine_protein          TEXT DEFAULT 'Negative',
    urine_glucose          TEXT DEFAULT 'Negative',
    oedema                 TEXT DEFAULT 'None',

    -- Interventions
    tt_vaccine             INTEGER DEFAULT 0,
    tt_dose_number         INTEGER,
    ipt_given              INTEGER DEFAULT 0,
    iron_folic_given       INTEGER DEFAULT 0,
    llin_given             INTEGER DEFAULT 0,

    -- Clinical
    complaints             TEXT,
    clinical_notes         TEXT,
    next_visit_date        DATE,
    attended_by            INTEGER REFERENCES users(user_id),
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ anc_visits'))
  .catch(e => console.log('  ⏭  anc_visits:', e.message.split('\n')[0]));

// ── delivery_records ──────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS delivery_records (
    delivery_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id                  INTEGER NOT NULL REFERENCES maternity_cases(case_id),
    patient_id               INTEGER NOT NULL REFERENCES patients(patient_id),

    -- Delivery details
    delivery_date            DATE NOT NULL,
    delivery_time            TEXT,
    gestational_age_at_delivery INTEGER,
    mode_of_delivery         TEXT NOT NULL DEFAULT 'SVD',
    outcome                  TEXT DEFAULT 'Live Birth',
    complications            TEXT,
    blood_loss_ml            INTEGER,

    -- Newborn
    newborn_sex              TEXT,
    birth_weight_kg          REAL,
    apgar_1min               INTEGER,
    apgar_5min               INTEGER,
    apgar_10min              INTEGER,
    resuscitation_needed     INTEGER DEFAULT 0,
    nicu_admission           INTEGER DEFAULT 0,
    newborn_notes            TEXT,

    -- Maternal
    placenta_complete        INTEGER DEFAULT 1,
    episiotomy               INTEGER DEFAULT 0,
    blood_transfusion        INTEGER DEFAULT 0,
    maternal_condition       TEXT DEFAULT 'Stable',
    discharge_date           DATE,
    postnatal_notes          TEXT,

    -- Staff
    delivered_by             INTEGER REFERENCES users(user_id),

    -- Admin
    created_by               INTEGER REFERENCES users(user_id),
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ delivery_records'))
  .catch(e => console.log('  ⏭  delivery_records:', e.message.split('\n')[0]));

// ── Indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_mat_patient   ON maternity_cases(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_mat_status    ON maternity_cases(status)',
  'CREATE INDEX IF NOT EXISTS idx_mat_edd       ON maternity_cases(edd)',
  'CREATE INDEX IF NOT EXISTS idx_anc_case      ON anc_visits(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_anc_patient   ON anc_visits(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_anc_date      ON anc_visits(visit_date)',
  'CREATE INDEX IF NOT EXISTS idx_del_case      ON delivery_records(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_del_patient   ON delivery_records(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_del_date      ON delivery_records(delivery_date)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

const r = await query('SELECT COUNT(*) as c FROM maternity_cases');
console.log(`\n🎉 Migration complete! maternity_cases rows: ${r.rows[0]?.c}`);