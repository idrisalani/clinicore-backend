-- ==========================================
-- PHASE 6: PHARMACY & PRESCRIPTION SYSTEM
-- ==========================================
-- This SQL adds pharmacy management tables
-- Run AFTER Phase 5 is complete

-- ==========================================
-- Medications Catalog Table
-- ==========================================
CREATE TABLE IF NOT EXISTS medication_catalog (
  medication_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Medication Information
  generic_name TEXT NOT NULL,
  brand_name TEXT,
  drug_code TEXT UNIQUE,
  
  -- Classification
  drug_class TEXT,
  category TEXT,
  strength TEXT,
  unit TEXT,
  
  -- Dosage Information
  default_dosage TEXT,
  default_frequency TEXT,
  
  -- Safety Information
  contraindications TEXT,
  side_effects TEXT,
  interactions TEXT,
  
  -- Pricing
  unit_cost REAL,
  currency TEXT DEFAULT 'NGN',
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Prescriptions Table
-- ==========================================
CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  patient_id INTEGER NOT NULL,
  consultation_id INTEGER,
  doctor_id INTEGER NOT NULL,
  medication_id INTEGER NOT NULL,
  
  -- Prescription Details
  prescription_date DATE NOT NULL,
  prescribed_dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,         -- Once daily, twice daily, etc.
  duration_days INTEGER,
  quantity INTEGER,
  refills_remaining INTEGER DEFAULT 0,
  
  -- Instructions
  instructions TEXT,
  special_instructions TEXT,
  
  -- Status
  status TEXT CHECK(status IN ('Active', 'Completed', 'Cancelled', 'Suspended')) DEFAULT 'Active',
  expiry_date DATE,
  
  -- Additional Info
  notes TEXT,
  
  -- Audit Fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id),
  FOREIGN KEY (doctor_id) REFERENCES users(user_id),
  FOREIGN KEY (medication_id) REFERENCES medication_catalog(medication_id)
);

-- ==========================================
-- Prescription Refills Table
-- ==========================================
CREATE TABLE IF NOT EXISTS prescription_refills (
  refill_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Key
  prescription_id INTEGER NOT NULL,
  
  -- Refill Details
  refill_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  refilled_by INTEGER,
  
  -- Notes
  notes TEXT,
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id),
  FOREIGN KEY (refilled_by) REFERENCES users(user_id)
);

-- ==========================================
-- Patient Medication History Table
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_medication_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  patient_id INTEGER NOT NULL,
  medication_id INTEGER NOT NULL,
  prescription_id INTEGER,
  
  -- History Details
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  effectiveness TEXT,
  adverse_reactions TEXT,
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (medication_id) REFERENCES medication_catalog(medication_id),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id)
);

-- ==========================================
-- Drug Interactions Reference Table
-- ==========================================
CREATE TABLE IF NOT EXISTS drug_interactions (
  interaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  medication_1_id INTEGER NOT NULL,
  medication_2_id INTEGER NOT NULL,
  
  -- Interaction Details
  severity TEXT CHECK(severity IN ('Low', 'Moderate', 'High', 'Contraindicated')),
  description TEXT,
  management TEXT,
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (medication_1_id) REFERENCES medication_catalog(medication_id),
  FOREIGN KEY (medication_2_id) REFERENCES medication_catalog(medication_id)
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

-- Medication Catalog Indexes
CREATE INDEX IF NOT EXISTS idx_medication_catalog_generic_name ON medication_catalog(generic_name);
CREATE INDEX IF NOT EXISTS idx_medication_catalog_drug_code ON medication_catalog(drug_code);
CREATE INDEX IF NOT EXISTS idx_medication_catalog_is_active ON medication_catalog(is_active);

-- Prescriptions Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_id ON prescriptions(medication_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescription_date ON prescriptions(prescription_date);

-- Prescription Refills Indexes
CREATE INDEX IF NOT EXISTS idx_prescription_refills_prescription_id ON prescription_refills(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_refills_refill_date ON prescription_refills(refill_date);

-- Patient Medication History Indexes
CREATE INDEX IF NOT EXISTS idx_patient_medication_history_patient_id ON patient_medication_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medication_history_medication_id ON patient_medication_history(medication_id);

-- Drug Interactions Indexes
CREATE INDEX IF NOT EXISTS idx_drug_interactions_medication_1 ON drug_interactions(medication_1_id);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_medication_2 ON drug_interactions(medication_2_id);

-- ==========================================
-- SAMPLE DATA (Optional - for testing)
-- ==========================================

-- Sample Medications (uncomment to seed)
/*
INSERT INTO medication_catalog (
  generic_name, brand_name, drug_code, drug_class, strength, unit,
  default_dosage, default_frequency, unit_cost
) VALUES
  ('Paracetamol', 'Panadol', 'MED-001', 'Analgesic', '500', 'mg', '500mg', 'Every 6 hours', 50),
  ('Amoxicillin', 'Amoxil', 'MED-002', 'Antibiotic', '250', 'mg', '250mg', 'Three times daily', 150),
  ('Ibuprofen', 'Brufen', 'MED-003', 'NSAID', '400', 'mg', '400mg', 'Every 8 hours', 100),
  ('Metformin', 'Diabex', 'MED-004', 'Antidiabetic', '500', 'mg', '500mg', 'Twice daily', 200),
  ('Atorvastatin', 'Lipitor', 'MED-005', 'Statin', '20', 'mg', '20mg', 'Once daily', 300);

-- Sample Prescriptions
INSERT INTO prescriptions (
  patient_id, doctor_id, medication_id, prescription_date,
  prescribed_dosage, frequency, duration_days, quantity, status, created_by
) VALUES
  (1, 1, 1, datetime('now'), '500mg', 'Every 6 hours', 7, 28, 'Active', 1),
  (2, 1, 2, datetime('now'), '250mg', 'Three times daily', 10, 30, 'Active', 1),
  (3, 1, 4, datetime('now'), '500mg', 'Twice daily', 30, 60, 'Active', 1);
*/

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
/*
1. Medication Catalog:
   - Central repository of all medications
   - Includes drug classification and strength
   - Stores unit cost in NGN currency
   - is_active flag for discontinued drugs

2. Prescriptions:
   - Links patient, doctor, and medication
   - Tracks dosage, frequency, and duration
   - Refills remaining for repeat prescriptions
   - Status: Active, Completed, Cancelled, Suspended

3. Prescription Refills:
   - Audit trail for refill requests
   - Tracks who refilled and when
   - Maintains medication history

4. Patient Medication History:
   - Historical record of all medications taken
   - Tracks effectiveness and adverse reactions
   - Supports clinical decision making
   - Helps identify medication allergies

5. Drug Interactions:
   - Reference table for drug-drug interactions
   - 4 severity levels: Low, Moderate, High, Contraindicated
   - Management recommendations included
   - Enables safety checks during prescription

6. Status Types:
   - Active: Currently prescribed, patient taking
   - Completed: Course finished, not discontinued
   - Cancelled: Stopped by doctor
   - Suspended: Temporarily paused

7. Currency:
   - Default NGN (Nigerian Naira)
   - Can be changed per medication

8. Integration:
   - Prescriptions link to consultations
   - Refill requests can generate new orders
   - Drug interactions checked at prescription time
   - Patient history shows all medications taken
*/