// ============================================
// audit_migration.mjs
// Run: node audit_migration.mjs  (from backend/)
//
// Upgrades activity_logs with richer audit fields.
// Safe to run multiple times — uses safeAlter pattern.
// ============================================
import { query } from './src/config/database.js';

console.log('🔍 Running Audit Trail migration...\n');

// Create full audit_logs table (separate from basic activity_logs)
await query(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    log_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(user_id),
    user_role     TEXT,
    full_name     TEXT,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    http_method   TEXT,
    endpoint      TEXT,
    status_code   INTEGER,
    ip_address    TEXT,
    user_agent    TEXT,
    changes_before TEXT,   -- JSON snapshot before change
    changes_after  TEXT,   -- JSON snapshot after change
    description   TEXT,    -- human-readable summary
    session_id    TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ audit_logs table'))
  .catch(e => console.log('  ⏭  audit_logs:', e.message.split('\n')[0]));

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action)',
  'CREATE INDEX IF NOT EXISTS idx_audit_resource  ON audit_logs(resource_type)',
  'CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_status    ON audit_logs(status_code)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

// Add missing columns to existing activity_logs (backward compat)
const extraCols = [
  "ALTER TABLE activity_logs ADD COLUMN http_method  TEXT",
  "ALTER TABLE activity_logs ADD COLUMN endpoint     TEXT",
  "ALTER TABLE activity_logs ADD COLUMN status_code  INTEGER",
  "ALTER TABLE activity_logs ADD COLUMN user_agent   TEXT",
  "ALTER TABLE activity_logs ADD COLUMN description  TEXT",
];
for (const sql of extraCols) {
  await query(sql).catch(e => {
    if (!e.message?.includes('duplicate column'))
      console.warn('  ⚠️ ', e.message.split('\n')[0]);
  });
}
console.log('  ✅ activity_logs columns extended');

const [a, al] = await Promise.all([
  query('SELECT COUNT(*) as c FROM audit_logs'),
  query('SELECT COUNT(*) as c FROM activity_logs'),
]);
console.log(`\n🎉 Done! audit_logs: ${a.rows[0]?.c} · activity_logs: ${al.rows[0]?.c}`);