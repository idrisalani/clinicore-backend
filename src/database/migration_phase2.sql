-- ============================================
-- CliniCore Phase 2 Database Migration
-- FIXED: Compatible with SQLite < 3.35.0
-- ============================================

-- ============================================
-- PART 1: ALTER PATIENTS TABLE
-- (Remove IF NOT EXISTS - older SQLite compatibility)
-- ============================================

ALTER TABLE patients ADD COLUMN gender TEXT CHECK(gender IN ('Male', 'Female', 'Other'));
ALTER TABLE patients ADD COLUMN blood_type TEXT CHECK(blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'));
ALTER TABLE patients ADD COLUMN allergies TEXT;
ALTER TABLE patients ADD COLUMN chronic_conditions TEXT;
ALTER TABLE patients ADD COLUMN city TEXT;
ALTER TABLE patients ADD COLUMN state TEXT;
ALTER TABLE patients ADD COLUMN zip_code TEXT;
ALTER TABLE patients ADD COLUMN country TEXT DEFAULT 'Nigeria';
ALTER TABLE patients ADD COLUMN insurance_provider TEXT;
ALTER TABLE patients ADD COLUMN insurance_policy_number TEXT;
ALTER TABLE patients ADD COLUMN insurance_group_number TEXT;
ALTER TABLE patients ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN emergency_contact_relationship TEXT;
ALTER TABLE patients ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE patients ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patients ADD COLUMN created_by INTEGER;
ALTER TABLE patients ADD COLUMN updated_by INTEGER;

-- ============================================
-- PART 2: CREATE APPOINTMENTS TABLE
-- ============================================

CREATE TABLE appointments (
  appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  reason_for_visit TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled', 'Completed', 'Cancelled', 'No-Show', 'Rescheduled')),
  is_confirmed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  updated_by INTEGER,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(user_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================
-- PART 3: CREATE MEDICAL HISTORY TABLE
-- ============================================

CREATE TABLE medical_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  visit_type TEXT CHECK(visit_type IN ('Consultation', 'Follow-up', 'Emergency', 'Procedure')),
  doctor_id INTEGER,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  medications_prescribed TEXT,
  vital_signs_bp TEXT,
  vital_signs_temp REAL,
  vital_signs_pulse INTEGER,
  vital_signs_respiration INTEGER,
  follow_up_date TEXT,
  follow_up_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(user_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE INDEX idx_medical_history_patient_id ON medical_history(patient_id);
CREATE INDEX idx_medical_history_visit_date ON medical_history(visit_date);
CREATE INDEX idx_medical_history_doctor_id ON medical_history(doctor_id);

-- ============================================
-- PART 4: CREATE MEDICATIONS TABLE
-- ============================================

CREATE TABLE medications (
  medication_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  history_id INTEGER,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT,
  instructions TEXT,
  is_active INTEGER DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT,
  prescribed_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
  FOREIGN KEY (history_id) REFERENCES medical_history(history_id),
  FOREIGN KEY (prescribed_by) REFERENCES users(user_id)
);

CREATE INDEX idx_medications_patient_id ON medications(patient_id);
CREATE INDEX idx_medications_is_active ON medications(is_active);

-- ============================================
-- PART 5: SEED DATA - TEST PATIENTS
-- ============================================

INSERT INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  user_id, created_by
) VALUES
('Chioma', 'Okafor', 'chioma.okafor@clinic.ng', '+234-801-234-5678', '1985-06-15', 'Female',
 'O+', 'Lagos', 'Lagos', 'Nigeria', 'NHIS', 'Emeka Okafor', '+234-801-234-5679', NULL, 1),
('Tunde', 'Adeyemi', 'tunde.adeyemi@clinic.ng', '+234-802-345-6789', '1978-03-22', 'Male',
 'A+', 'Ibadan', 'Oyo', 'Nigeria', 'Axa Mansard', 'Ayo Adeyemi', '+234-802-345-6790', NULL, 1),
('Zainab', 'Hassan', 'zainab.hassan@clinic.ng', '+234-803-456-7890', '1992-09-10', 'Female',
 'B-', 'Kano', 'Kano', 'Nigeria', 'UAC', 'Ibrahim Hassan', '+234-803-456-7891', NULL, 1),
('Ikechukwu', 'Nwosu', 'ikechukwu.nwosu@clinic.ng', '+234-804-567-8901', '1988-12-05', 'Male',
 'AB+', 'Port Harcourt', 'Rivers', 'Nigeria', 'Allianz', 'Chinedu Nwosu', '+234-804-567-8902', NULL, 1),
('Amara', 'Okoro', 'amara.okoro@clinic.ng', '+234-805-678-9012', '1995-01-28', 'Female',
 'O-', 'Abuja', 'FCT', 'Nigeria', 'NHIS', 'Nonso Okoro', '+234-805-678-9013', NULL, 1);

-- ============================================
-- PART 6: SEED DATA - TEST APPOINTMENTS
-- ============================================

INSERT INTO appointments (
  patient_id, doctor_id, appointment_date, appointment_time,
  duration_minutes, reason_for_visit, status, created_by
) VALUES
(1, 1, date('now', '+1 day'), '09:00', 30, 'General Checkup', 'Scheduled', 1),
(2, 1, date('now', '+2 days'), '10:30', 30, 'Follow-up', 'Scheduled', 1),
(3, 1, date('now', '+3 days'), '14:00', 45, 'Consultation', 'Scheduled', 1);

-- ============================================
-- PART 7: SEED DATA - TEST MEDICAL HISTORY
-- ============================================

INSERT INTO medical_history (
  patient_id, doctor_id, visit_date, visit_type,
  chief_complaint, diagnosis, treatment_plan, created_by
) VALUES
(1, 1, date('now', '-7 days'), 'Consultation',
 'Headache and fever', 'Malaria', 'Antimalarial drugs for 3 days', 1),
(2, 1, date('now', '-14 days'), 'Follow-up',
 'Post-treatment check', 'Recovery on track', 'Continue medication', 1);

-- ============================================
-- Migration complete!
-- ============================================
-- Total operations:
-- 1. Added 18 new columns to patients table
-- 2. Created appointments table
-- 3. Created medical_history table
-- 4. Created medications table
-- 5. Created 6 indexes
-- 6. Loaded 5 seed patients
-- 7. Loaded 3 seed appointments
-- 8. Loaded 2 seed medical history records
--
-- No data was lost - all existing data preserved
-- ============================================