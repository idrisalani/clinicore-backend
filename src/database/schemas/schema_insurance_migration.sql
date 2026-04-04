-- ============================================
-- INSURANCE CLAIMS MIGRATION
-- File: backend/src/database/schemas/schema_insurance_migration.sql
-- Adds insurance claim tracking to billing system
-- Run once: node src/database/run_insurance_migration.js
-- ============================================

-- ── Add insurance fields to invoices table ────────────────────────────────────
ALTER TABLE invoices ADD COLUMN insurance_provider     TEXT;
ALTER TABLE invoices ADD COLUMN insurance_policy_number TEXT;
ALTER TABLE invoices ADD COLUMN insurance_claim_number  TEXT;
ALTER TABLE invoices ADD COLUMN insurance_claim_amount  REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN insurance_claim_status  TEXT DEFAULT 'None'
  CHECK(insurance_claim_status IN ('None','Submitted','Under Review','Approved','Partially Approved','Rejected','Paid'));
ALTER TABLE invoices ADD COLUMN insurance_claim_date    DATE;
ALTER TABLE invoices ADD COLUMN insurance_approved_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN insurance_rejection_reason TEXT;
ALTER TABLE invoices ADD COLUMN insurance_notes        TEXT;
ALTER TABLE invoices ADD COLUMN patient_liability      REAL DEFAULT 0;

-- ── Standalone insurance_claims table ────────────────────────────────────────
-- Allows multiple claims per invoice (e.g. primary + secondary insurer)
CREATE TABLE IF NOT EXISTS insurance_claims (
  claim_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id        INTEGER NOT NULL,
  patient_id        INTEGER NOT NULL,

  -- Insurer details
  insurance_provider     TEXT NOT NULL,
  insurance_policy_number TEXT,
  insurance_group_number  TEXT,
  member_id              TEXT,

  -- Claim details
  claim_number      TEXT UNIQUE,
  claim_date        DATE NOT NULL,
  claim_amount      REAL NOT NULL,
  approved_amount   REAL DEFAULT 0,
  patient_liability REAL DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'Submitted' CHECK(
    status IN ('Submitted','Under Review','Approved','Partially Approved','Rejected','Paid','Appealed')
  ),
  status_date       DATE,
  rejection_reason  TEXT,
  appeal_notes      TEXT,

  -- Response tracking
  response_date     DATE,
  payment_date      DATE,
  reference_number  TEXT,

  -- Notes
  notes             TEXT,
  diagnosis_codes   TEXT,   -- ICD-10 codes (comma-separated)
  procedure_codes   TEXT,   -- CPT/procedure codes

  -- Audit
  created_by        INTEGER,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by        INTEGER,
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (invoice_id)  REFERENCES invoices(invoice_id),
  FOREIGN KEY (patient_id)  REFERENCES patients(patient_id),
  FOREIGN KEY (created_by)  REFERENCES users(user_id),
  FOREIGN KEY (updated_by)  REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_claims_invoice_id  ON insurance_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_claims_patient_id  ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status      ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_claim_date  ON insurance_claims(claim_date);
CREATE INDEX IF NOT EXISTS idx_claims_provider    ON insurance_claims(insurance_provider);

-- ============================================
-- Migration Complete
-- ============================================