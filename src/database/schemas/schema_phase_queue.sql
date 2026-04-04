-- ============================================
-- QUEUE MANAGEMENT SCHEMA
-- File: backend/src/database/schemas/schema_phase_queue.sql
-- ============================================

-- ============================================
-- Queue Table
-- Tracks patient check-ins and waiting status
-- ============================================
CREATE TABLE IF NOT EXISTS queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    appointment_id INTEGER,                         -- optional link to appointment
    doctor_id INTEGER,                              -- assigned doctor
    check_in_time TEXT DEFAULT CURRENT_TIMESTAMP,
    call_time TEXT,                                 -- when doctor called patient
    start_time TEXT,                                -- when consultation started
    end_time TEXT,                                  -- when consultation ended
    queue_number INTEGER NOT NULL,                  -- display number e.g. 001
    queue_date TEXT NOT NULL,                       -- YYYY-MM-DD (today's queue)
    status TEXT DEFAULT 'Waiting' CHECK(
        status IN ('Waiting','Called','In Consultation','Completed','No-Show','Skipped')
    ),
    priority TEXT DEFAULT 'Normal' CHECK(
        priority IN ('Normal','Urgent','Emergency')
    ),
    reason_for_visit TEXT,
    notes TEXT,
    served_by INTEGER,                              -- doctor/staff who served
    wait_minutes INTEGER,                           -- calculated wait time
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (patient_id)     REFERENCES patients(patient_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    FOREIGN KEY (doctor_id)      REFERENCES users(user_id),
    FOREIGN KEY (served_by)      REFERENCES users(user_id),
    FOREIGN KEY (created_by)     REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_date         ON queue(queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_patient_id   ON queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_status       ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_doctor_id    ON queue(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_date_status  ON queue(queue_date, status);

-- ============================================
-- Queue Schema Complete
-- ============================================