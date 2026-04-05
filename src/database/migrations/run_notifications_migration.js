// ============================================
// run_notifications_migration.js
// File: backend/src/database/migrations/run_notifications_migration.js
//
// Run: node src/database/migrations/run_notifications_migration.js
// ============================================

import { query } from '../../config/database.js';

const migrate = async () => {
  console.log('🔄 Running notifications + 2FA migration...\n');

  const steps = [
    {
      name: 'notifications_log table',
      sql: `CREATE TABLE IF NOT EXISTS notifications_log (
        log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        patient_id   INTEGER REFERENCES patients(patient_id) ON DELETE SET NULL,
        type         TEXT NOT NULL,
        channel      TEXT NOT NULL,
        recipient    TEXT NOT NULL,
        subject      TEXT,
        body         TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'sent',
        reference_id TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      name: 'notifications_log index (patient)',
      sql: `CREATE INDEX IF NOT EXISTS idx_notif_patient ON notifications_log(patient_id)`,
    },
    {
      name: 'notifications_log index (type)',
      sql: `CREATE INDEX IF NOT EXISTS idx_notif_type ON notifications_log(type)`,
    },
    {
      name: 'notifications_log index (created_at)',
      sql: `CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications_log(created_at)`,
    },
    {
      name: 'user_2fa table',
      sql: `CREATE TABLE IF NOT EXISTS user_2fa (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
        secret        TEXT NOT NULL,
        is_enabled    INTEGER NOT NULL DEFAULT 0,
        backup_codes  TEXT,
        enrolled_at   DATETIME,
        last_used_at  DATETIME,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      name: 'user_2fa index',
      sql: `CREATE INDEX IF NOT EXISTS idx_2fa_user ON user_2fa(user_id)`,
    },
    {
      name: 'users.two_fa_enabled column',
      sql: `ALTER TABLE users ADD COLUMN two_fa_enabled INTEGER NOT NULL DEFAULT 0`,
      ignoreDuplicate: true,
    },
    {
      name: 'users.two_fa_enforced_at column',
      sql: `ALTER TABLE users ADD COLUMN two_fa_enforced_at DATETIME`,
      ignoreDuplicate: true,
    },
  ];

  let passed = 0;
  let skipped = 0;

  for (const step of steps) {
    try {
      await query(step.sql);
      console.log(`  ✅ ${step.name}`);
      passed++;
    } catch (err) {
      const isDupe = err.message?.includes('already exists') ||
                     err.message?.includes('duplicate column');
      if (isDupe && step.ignoreDuplicate) {
        console.log(`  ℹ  ${step.name} — already exists, skipping`);
        skipped++;
      } else {
        console.error(`  ❌ ${step.name}: ${err.message}`);
      }
    }
  }

  console.log(`\n📊 Migration complete: ${passed} applied, ${skipped} skipped`);
  process.exit(0);
};

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});