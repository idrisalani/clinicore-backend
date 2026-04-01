-- ============================================
-- MIGRATION 001: Add Recipient Information to Invoices
-- Date: 2026-04-01
-- ============================================
-- This migration adds professional invoice recipient fields.
-- Required for sending invoices to customers.
-- Backward compatible - adds columns with defaults.
-- ============================================

-- ============================================
-- Add Recipient Information Fields
-- ============================================

ALTER TABLE invoices ADD COLUMN recipient_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN recipient_email TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN recipient_phone TEXT;

-- ============================================
-- Update Defaults for Existing Records
-- ============================================

-- Set recipient_name to patient's full name for existing invoices
UPDATE invoices 
SET recipient_name = (
  SELECT CONCAT(patients.first_name, ' ', patients.last_name)
  FROM patients
  WHERE patients.patient_id = invoices.patient_id
)
WHERE recipient_name = '';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 1. Added recipient_name field (required)
-- 2. Added recipient_email field (required)
-- 3. Added recipient_phone field (optional)
-- 4. Populated existing records with patient names
--
-- All invoices now have complete recipient information.
-- ============================================