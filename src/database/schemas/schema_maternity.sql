-- ============================================
-- Maternity Module Schema
-- File: backend/src/database/schemas/schema_maternity.sql
--
-- For reference only — actual migration runs via:
--   node src/database/migrations/run_maternity_migration.js
-- ============================================

CREATE TABLE IF NOT EXISTS maternity_cases (
  case_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id           INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,

  -- Pregnancy dating
  lmp_date             DATE,                         -- Last Menstrual Period
  edd                  DATE,                         -- Estimated Due Date (LMP + 280 days)
  edd_by_scan          DATE,                         -- EDD confirmed by ultrasound
  gestational_age_weeks INTEGER,                     -- at registration

  -- Obstetric history
  gravida              INTEGER NOT NULL DEFAULT 1,   -- total pregnancies including current
  parity               INTEGER NOT NULL DEFAULT 0,   -- completed deliveries past 28 weeks
  previous_cs          INTEGER NOT NULL DEFAULT 0,   -- number of previous C-sections
  previous_miscarriages INTEGER NOT NULL DEFAULT 0,
  previous_stillbirths  INTEGER NOT NULL DEFAULT 0,

  -- Current pregnancy
  booking_date         DATE,
  blood_group          TEXT,                         -- A+, O-, etc.
  rhesus_factor        TEXT CHECK(rhesus_factor IN ('Positive','Negative')),
  hiv_status           TEXT CHECK(hiv_status IN ('Negative','Positive','Unknown')),
  hb_at_booking        REAL,                         -- haemoglobin g/dL

  -- Risk classification
  risk_level           TEXT NOT NULL DEFAULT 'Low'
                         CHECK(risk_level IN ('Low','Moderate','High','Very High')),
  risk_factors         TEXT,                         -- comma-separated

  -- Progress
  anc_count            INTEGER NOT NULL DEFAULT 0,   -- ANC visits attended
  status               TEXT NOT NULL DEFAULT 'Active'
                         CHECK(status IN ('Active','Delivered','Transferred','Lost to Follow-up','Deceased')),
  outcome              TEXT,                         -- brief summary after delivery

  -- Admin
  notes                TEXT,
  created_by           INTEGER REFERENCES users(user_id),
  updated_by           INTEGER REFERENCES users(user_id),
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maternity_patient ON maternity_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_maternity_status  ON maternity_cases(status);
CREATE INDEX IF NOT EXISTS idx_maternity_edd      ON maternity_cases(edd);


CREATE TABLE IF NOT EXISTS anc_visits (
  visit_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id              INTEGER NOT NULL REFERENCES maternity_cases(case_id) ON DELETE CASCADE,
  patient_id           INTEGER NOT NULL REFERENCES patients(patient_id),

  -- Visit details
  visit_date           DATE NOT NULL,
  gestational_week     INTEGER,                      -- weeks at time of visit
  visit_type           TEXT DEFAULT 'Routine'
                         CHECK(visit_type IN ('Routine','Emergency','Follow-up')),

  -- Vitals
  weight_kg            REAL,
  bp_systolic          INTEGER,                      -- mmHg
  bp_diastolic         INTEGER,                      -- mmHg
  temperature_c        REAL,
  pulse_bpm            INTEGER,
  haemoglobin          REAL,                         -- g/dL

  -- Obstetric examination
  fundal_height_cm     REAL,                         -- symphysis-fundal height
  fetal_presentation   TEXT
    CHECK(fetal_presentation IN ('Cephalic','Breech','Transverse','Oblique','Unknown')),
  fetal_heart_rate     INTEGER,                      -- bpm
  fetal_movement       TEXT CHECK(fetal_movement IN ('Present','Absent','Reduced')),
  lie                  TEXT CHECK(lie IN ('Longitudinal','Transverse','Oblique')),
  engagement           TEXT CHECK(engagement IN ('Engaged','Not Engaged','Partially')),

  -- Urine / oedema
  urine_protein        TEXT CHECK(urine_protein IN ('Negative','Trace','+1','+2','+3','+4')),
  urine_glucose        TEXT CHECK(urine_glucose IN ('Negative','Trace','+1','+2','+3','+4')),
  oedema               TEXT CHECK(oedema IN ('None','Mild','Moderate','Severe')),

  -- Interventions
  tt_vaccine           INTEGER DEFAULT 0,             -- Tetanus Toxoid given (bool)
  tt_dose_number       INTEGER,
  ipt_given            INTEGER DEFAULT 0,             -- Intermittent Preventive Treatment
  iron_folic_given     INTEGER DEFAULT 0,
  llin_given           INTEGER DEFAULT 0,             -- Long-Lasting Insecticidal Net

  -- Clinical
  complaints           TEXT,
  clinical_notes       TEXT,
  next_visit_date      DATE,

  -- Admin
  attended_by          INTEGER REFERENCES users(user_id),
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anc_case    ON anc_visits(case_id);
CREATE INDEX IF NOT EXISTS idx_anc_patient ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_date    ON anc_visits(visit_date);


CREATE TABLE IF NOT EXISTS delivery_records (
  delivery_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id              INTEGER NOT NULL UNIQUE REFERENCES maternity_cases(case_id),
  patient_id           INTEGER NOT NULL REFERENCES patients(patient_id),

  -- Delivery details
  delivery_date        DATE NOT NULL,
  delivery_time        TIME,
  gestational_age_at_delivery INTEGER,
  mode_of_delivery     TEXT NOT NULL
    CHECK(mode_of_delivery IN ('SVD','Assisted Vaginal','Emergency CS','Elective CS','Vacuum','Forceps')),

  -- Outcome
  outcome              TEXT NOT NULL
    CHECK(outcome IN ('Live Birth','Stillbirth','Neonatal Death','Maternal Death')),
  complications        TEXT,                         -- comma-separated
  blood_loss_ml        INTEGER,

  -- Newborn
  newborn_sex          TEXT CHECK(newborn_sex IN ('Male','Female','Indeterminate')),
  birth_weight_kg      REAL,
  apgar_1min           INTEGER,                      -- 0-10
  apgar_5min           INTEGER,                      -- 0-10
  apgar_10min          INTEGER,
  resuscitation_needed INTEGER DEFAULT 0,
  nicu_admission       INTEGER DEFAULT 0,
  newborn_notes        TEXT,

  -- Mother post-delivery
  placenta_complete    INTEGER DEFAULT 1,
  episiotomy           INTEGER DEFAULT 0,
  blood_transfusion    INTEGER DEFAULT 0,
  maternal_condition   TEXT DEFAULT 'Stable'
    CHECK(maternal_condition IN ('Stable','Critical','Transferred','Deceased')),
  discharge_date       DATE,
  postnatal_notes      TEXT,

  -- Admin
  delivered_by         INTEGER REFERENCES users(user_id),
  created_by           INTEGER REFERENCES users(user_id),
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_case    ON delivery_records(case_id);
CREATE INDEX IF NOT EXISTS idx_delivery_patient ON delivery_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_delivery_date    ON delivery_records(delivery_date);