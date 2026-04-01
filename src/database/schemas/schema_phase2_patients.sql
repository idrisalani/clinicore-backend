-- ============================================
-- PHASE 2: PATIENTS & MEDICAL HISTORY
-- ============================================

-- ============================================
-- Patients Table (Extended)
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
    blood_type TEXT CHECK(blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown')),
    allergies TEXT,
    chronic_conditions TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'Nigeria',
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    insurance_group_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    is_active INTEGER DEFAULT 1,
    registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

-- ============================================
-- Medical History Table
-- ============================================
CREATE TABLE IF NOT EXISTS medical_history (
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

CREATE INDEX IF NOT EXISTS idx_medical_history_patient_id ON medical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_history_visit_date ON medical_history(visit_date);
CREATE INDEX IF NOT EXISTS idx_medical_history_doctor_id ON medical_history(doctor_id);

-- ============================================
-- Medications Table
-- ============================================
CREATE TABLE IF NOT EXISTS medications (
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

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_is_active ON medications(is_active);

-- ============================================
-- Phase 2 Schema Complete
-- ============================================