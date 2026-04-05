-- ============================================
-- Schema: Notifications log + 2FA tables
-- File: backend/src/database/schemas/schema_phase_notifications.sql
-- Run once: sqlite3 clinicore.db < schema_phase_notifications.sql
-- ============================================

-- ── Notification audit log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications_log (
  log_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  patient_id    INTEGER REFERENCES patients(patient_id) ON DELETE SET NULL,
  type          TEXT NOT NULL,        -- appointment_reminder | queue_called | lab_result | invoice | payment | portal_credentials | low_stock
  channel       TEXT NOT NULL,        -- sms | email | both
  recipient     TEXT NOT NULL,        -- phone number or email address
  subject       TEXT,                 -- email subject (null for SMS)
  body          TEXT NOT NULL,        -- message body
  status        TEXT NOT NULL DEFAULT 'sent', -- sent | failed | pending
  reference_id  TEXT,                 -- e.g. appointment_id, invoice_id
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_patient   ON notifications_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_notif_type      ON notifications_log(type);
CREATE INDEX IF NOT EXISTS idx_notif_created   ON notifications_log(created_at);

-- ── 2FA secrets ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_2fa (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  secret          TEXT NOT NULL,          -- speakeasy TOTP secret (encrypted at rest)
  is_enabled      INTEGER NOT NULL DEFAULT 0,
  backup_codes    TEXT,                   -- JSON array of one-time backup codes (hashed)
  enrolled_at     DATETIME,
  last_used_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_2fa_user ON user_2fa(user_id);

-- ── Add 2FA flag to users table (if not exists) ───────────────────────────────
-- SQLite: ALTER TABLE only supports ADD COLUMN
-- Run each separately — ignore "duplicate column" errors
ALTER TABLE users ADD COLUMN two_fa_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN two_fa_enforced_at DATETIME;