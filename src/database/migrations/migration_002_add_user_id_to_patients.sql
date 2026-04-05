-- ============================================
-- Migration: Add user_id to patients table
-- File: backend/src/database/migrations/add_user_id_to_patients.sql
-- Run ONCE on existing database
-- ============================================

-- Add user_id column linking patients to their login account
ALTER TABLE patients ADD COLUMN user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

-- ── For EXISTING patients: create user accounts retroactively ─────────────────
-- Run this block manually in SQLite after applying the migration,
-- or use the migration script (migrate_existing_patients.js) below.
-- It creates a user account for every patient that doesn't have one yet.