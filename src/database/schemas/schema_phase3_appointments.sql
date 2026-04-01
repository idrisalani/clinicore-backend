-- ============================================
-- PHASE 3: APPOINTMENTS MANAGEMENT
-- ============================================

-- ============================================
-- Appointments Table
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
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

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================
-- Phase 3 Schema Complete
-- ============================================