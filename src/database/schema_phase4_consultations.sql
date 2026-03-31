-- ==========================================
-- PHASE 4: CLINICAL CONSULTATIONS SYSTEM
-- ==========================================
-- This SQL adds consultations table
-- Run this BEFORE Phase 4 frontend/backend

-- ==========================================
-- Consultations Table
-- ==========================================
CREATE TABLE IF NOT EXISTS consultations (
  consultation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  appointment_id INTEGER,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER,
  
  -- Consultation Information
  consultation_date DATE NOT NULL,
  
  -- Chief Complaint & History
  chief_complaint TEXT NOT NULL,
  history_of_present_illness TEXT,
  past_medical_history TEXT,
  medications TEXT,
  allergies TEXT,
  
  -- Vital Signs
  vital_signs_bp TEXT,                    -- e.g., "120/80"
  vital_signs_temp TEXT,                  -- e.g., "37.0"
  vital_signs_pulse TEXT,                 -- e.g., "72"
  vital_signs_respiration TEXT,           -- e.g., "16"
  
  -- Physical Examination
  physical_examination TEXT,
  
  -- Diagnosis & Treatment
  diagnosis TEXT NOT NULL,
  diagnosis_icd TEXT,                     -- ICD code
  treatment_plan TEXT NOT NULL,
  medications_prescribed TEXT,
  procedures TEXT,
  
  -- Follow-up & Referral
  follow_up_date DATE,
  follow_up_notes TEXT,
  referral_needed INTEGER DEFAULT 0,      -- 0 = no, 1 = yes
  referral_to TEXT,                       -- Specialist type
  
  -- Additional Notes
  notes TEXT,
  
  -- Status
  status TEXT CHECK(status IN ('Draft', 'Completed', 'Signed', 'Reviewed')) DEFAULT 'Draft',
  
  -- Audit Fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES users(user_id)
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_appointment_id ON consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
/*
1. Consultations:
   - Stores clinical consultation records
   - Links to appointments (optional)
   - Tracks vital signs, diagnosis, treatment
   - Supports referrals and follow-ups

2. Status Types:
   - Draft: Initial recording, can still edit
   - Completed: All information recorded
   - Signed: Doctor has signed the note
   - Reviewed: Reviewed by supervising physician

3. Integration:
   - Created from appointment or standalone
   - Links to patient for medical history
   - Tracks doctor who performed consultation
   - Supports audit trail with created_by/updated_by

4. Fields:
   - 25 fields total including audit trail
   - Chief complaint is required
   - Diagnosis is required
   - Treatment plan is required
   - Everything else is optional
*/