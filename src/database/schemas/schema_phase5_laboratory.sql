-- ==========================================
-- PHASE 5: LABORATORY MANAGEMENT SYSTEM
-- ==========================================
-- This SQL adds lab_orders and lab_results tables
-- Run this AFTER Phase 4 tables are created

-- ==========================================
-- Lab Orders Table
-- ==========================================
CREATE TABLE IF NOT EXISTS lab_orders (
  lab_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  patient_id INTEGER NOT NULL,
  consultation_id INTEGER,
  doctor_id INTEGER,
  
  -- Test Information
  test_type TEXT NOT NULL,        -- CBC, CMP, Glucose, etc.
  test_code TEXT,                  -- Lab code for the test
  test_name TEXT NOT NULL,         -- Full test name
  specimen_type TEXT,              -- Blood, Urine, Tissue, etc.
  
  -- Order Details
  priority TEXT CHECK(priority IN ('Routine', 'Urgent', 'Stat')) DEFAULT 'Routine',
  instructions TEXT,               -- Special instructions (fasting, etc.)
  ordered_date DATE,               -- When the order was placed
  expected_date DATE,              -- When results are expected
  
  -- Status
  status TEXT CHECK(status IN ('Ordered', 'In Progress', 'Completed', 'Cancelled', 'Pending')) DEFAULT 'Ordered',
  
  -- Notes
  notes TEXT,
  
  -- Audit Fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id),
  FOREIGN KEY (doctor_id) REFERENCES users(user_id)
);

-- ==========================================
-- Lab Results Table
-- ==========================================
CREATE TABLE IF NOT EXISTS lab_results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Key
  lab_order_id INTEGER NOT NULL,
  
  -- Result Information
  result_value TEXT NOT NULL,      -- The actual test result value
  unit TEXT,                        -- Unit of measurement (mg/dL, mmol/L, etc.)
  reference_range TEXT,            -- Normal reference range
  
  -- Result Status
  result_status TEXT CHECK(result_status IN ('Normal', 'Abnormal', 'Critical', 'Pending')) DEFAULT 'Pending',
  interpretation TEXT,             -- Clinical interpretation
  
  -- Dates
  test_date DATE,                  -- When test was performed
  completion_date DATE,            -- When results were completed
  performed_by TEXT,               -- Lab technician name
  
  -- Notes
  notes TEXT,
  
  -- Audit Fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (lab_order_id) REFERENCES lab_orders(lab_order_id)
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

-- Lab Orders Indexes
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_consultation_id ON lab_orders(consultation_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_id ON lab_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_ordered_date ON lab_orders(ordered_date);

-- Lab Results Indexes
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order_id ON lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_result_status ON lab_results(result_status);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_date ON lab_results(test_date);

-- ==========================================
-- SAMPLE DATA (Optional - for testing)
-- ==========================================

-- Sample Lab Orders (uncomment to seed)
/*
INSERT INTO lab_orders (
  patient_id, consultation_id, doctor_id, test_type, test_code,
  test_name, specimen_type, priority, instructions,
  ordered_date, expected_date, status, notes, created_by
) VALUES
  (1, 1, 1, 'CBC', 'LAB-001', 'Complete Blood Count', 'Blood', 'Routine', 'Fasting preferred', 
   datetime('now'), datetime('now', '+2 days'), 'Ordered', 'Initial CBC test', 1),
  (2, 2, 1, 'CMP', 'LAB-002', 'Comprehensive Metabolic Panel', 'Blood', 'Urgent', 'Fasting required',
   datetime('now'), datetime('now', '+1 day'), 'In Progress', 'Follow-up CMP', 1),
  (3, null, 1, 'TSH', 'LAB-003', 'Thyroid Stimulating Hormone', 'Blood', 'Routine', null,
   datetime('now'), datetime('now', '+3 days'), 'Ordered', 'Thyroid screening', 1);

-- Sample Lab Results
INSERT INTO lab_results (
  lab_order_id, result_value, unit, reference_range,
  result_status, interpretation, test_date, completion_date,
  performed_by, notes, created_by
) VALUES
  (2, '4.5-11.0', 'K/uL', '4.5-11.0', 'Normal', 'WBC count within normal range', 
   datetime('now', '-1 day'), datetime('now'), 'John Lab Tech', 'Standard processing', 1),
  (2, '12.5', 'g/dL', '12.0-17.5', 'Normal', 'Hemoglobin level normal for female', 
   datetime('now', '-1 day'), datetime('now'), 'John Lab Tech', 'Standard processing', 1);
*/

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
/*
1. Lab Orders:
   - Stores all laboratory test orders for patients
   - Links to consultations (optional - may be ordered separately)
   - Tracks test type, specimen type, priority, and status
   - Supports 5 status types: Ordered, In Progress, Completed, Cancelled, Pending

2. Lab Results:
   - Stores individual test results for each lab order
   - One lab order can have multiple results (CBC has multiple values)
   - Tracks result value, units, reference range, and status
   - Supports result status: Normal, Abnormal, Critical, Pending

3. Priority Levels:
   - Routine: Normal priority, can be done in standard timeframe
   - Urgent: Higher priority, needs faster processing
   - Stat: Emergency, must be done immediately

4. Integration:
   - Lab orders can be created from consultations
   - Results update the lab order status to Completed
   - Patient detail page shows related lab orders
   - Consultation page can link to lab orders for that visit

5. Audit Trail:
   - All changes tracked with created_by and updated_by
   - Timestamps for all operations
   - Supports compliance and audit requirements
*/