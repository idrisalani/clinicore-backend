// ============================================
// run_maternity_migration.js
// File: backend/src/database/migrations/run_maternity_migration.js
// Run: node src/database/migrations/run_maternity_migration.js
// ============================================

import { query } from '../../config/database.js';

const steps = [
  {
    name: 'maternity_cases table',
    sql: `CREATE TABLE IF NOT EXISTS maternity_cases (
      case_id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id           INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
      lmp_date             DATE,
      edd                  DATE,
      edd_by_scan          DATE,
      gestational_age_weeks INTEGER,
      gravida              INTEGER NOT NULL DEFAULT 1,
      parity               INTEGER NOT NULL DEFAULT 0,
      previous_cs          INTEGER NOT NULL DEFAULT 0,
      previous_miscarriages INTEGER NOT NULL DEFAULT 0,
      previous_stillbirths  INTEGER NOT NULL DEFAULT 0,
      booking_date         DATE,
      blood_group          TEXT,
      rhesus_factor        TEXT,
      hiv_status           TEXT,
      hb_at_booking        REAL,
      risk_level           TEXT NOT NULL DEFAULT 'Low',
      risk_factors         TEXT,
      anc_count            INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL DEFAULT 'Active',
      outcome              TEXT,
      notes                TEXT,
      created_by           INTEGER REFERENCES users(user_id),
      updated_by           INTEGER REFERENCES users(user_id),
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'idx_maternity_patient', sql: `CREATE INDEX IF NOT EXISTS idx_maternity_patient ON maternity_cases(patient_id)` },
  { name: 'idx_maternity_status',  sql: `CREATE INDEX IF NOT EXISTS idx_maternity_status  ON maternity_cases(status)` },
  { name: 'idx_maternity_edd',     sql: `CREATE INDEX IF NOT EXISTS idx_maternity_edd     ON maternity_cases(edd)` },
  {
    name: 'anc_visits table',
    sql: `CREATE TABLE IF NOT EXISTS anc_visits (
      visit_id             INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id              INTEGER NOT NULL REFERENCES maternity_cases(case_id) ON DELETE CASCADE,
      patient_id           INTEGER NOT NULL REFERENCES patients(patient_id),
      visit_date           DATE NOT NULL,
      gestational_week     INTEGER,
      visit_type           TEXT DEFAULT 'Routine',
      weight_kg            REAL,
      bp_systolic          INTEGER,
      bp_diastolic         INTEGER,
      temperature_c        REAL,
      pulse_bpm            INTEGER,
      haemoglobin          REAL,
      fundal_height_cm     REAL,
      fetal_presentation   TEXT,
      fetal_heart_rate     INTEGER,
      fetal_movement       TEXT,
      lie                  TEXT,
      engagement           TEXT,
      urine_protein        TEXT,
      urine_glucose        TEXT,
      oedema               TEXT,
      tt_vaccine           INTEGER DEFAULT 0,
      tt_dose_number       INTEGER,
      ipt_given            INTEGER DEFAULT 0,
      iron_folic_given     INTEGER DEFAULT 0,
      llin_given           INTEGER DEFAULT 0,
      complaints           TEXT,
      clinical_notes       TEXT,
      next_visit_date      DATE,
      attended_by          INTEGER REFERENCES users(user_id),
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'idx_anc_case',    sql: `CREATE INDEX IF NOT EXISTS idx_anc_case    ON anc_visits(case_id)` },
  { name: 'idx_anc_patient', sql: `CREATE INDEX IF NOT EXISTS idx_anc_patient ON anc_visits(patient_id)` },
  { name: 'idx_anc_date',    sql: `CREATE INDEX IF NOT EXISTS idx_anc_date    ON anc_visits(visit_date)` },
  {
    name: 'delivery_records table',
    sql: `CREATE TABLE IF NOT EXISTS delivery_records (
      delivery_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id              INTEGER NOT NULL UNIQUE REFERENCES maternity_cases(case_id),
      patient_id           INTEGER NOT NULL REFERENCES patients(patient_id),
      delivery_date        DATE NOT NULL,
      delivery_time        TIME,
      gestational_age_at_delivery INTEGER,
      mode_of_delivery     TEXT NOT NULL DEFAULT 'SVD',
      outcome              TEXT NOT NULL DEFAULT 'Live Birth',
      complications        TEXT,
      blood_loss_ml        INTEGER,
      newborn_sex          TEXT,
      birth_weight_kg      REAL,
      apgar_1min           INTEGER,
      apgar_5min           INTEGER,
      apgar_10min          INTEGER,
      resuscitation_needed INTEGER DEFAULT 0,
      nicu_admission       INTEGER DEFAULT 0,
      newborn_notes        TEXT,
      placenta_complete    INTEGER DEFAULT 1,
      episiotomy           INTEGER DEFAULT 0,
      blood_transfusion    INTEGER DEFAULT 0,
      maternal_condition   TEXT DEFAULT 'Stable',
      discharge_date       DATE,
      postnatal_notes      TEXT,
      delivered_by         INTEGER REFERENCES users(user_id),
      created_by           INTEGER REFERENCES users(user_id),
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'idx_delivery_case',    sql: `CREATE INDEX IF NOT EXISTS idx_delivery_case    ON delivery_records(case_id)` },
  { name: 'idx_delivery_patient', sql: `CREATE INDEX IF NOT EXISTS idx_delivery_patient ON delivery_records(patient_id)` },
  { name: 'idx_delivery_date',    sql: `CREATE INDEX IF NOT EXISTS idx_delivery_date    ON delivery_records(delivery_date)` },
];

const migrate = async () => {
  console.log('🔄 Running maternity module migration...\n');
  let passed = 0; let skipped = 0;

  for (const step of steps) {
    try {
      await query(step.sql);
      console.log(`  ✅ ${step.name}`);
      passed++;
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`  ℹ  ${step.name} — already exists`);
        skipped++;
      } else {
        console.error(`  ❌ ${step.name}: ${err.message}`);
      }
    }
  }

  console.log(`\n📊 Migration complete: ${passed} applied, ${skipped} skipped`);
  process.exit(0);
};

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });