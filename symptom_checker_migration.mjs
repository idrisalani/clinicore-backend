// ============================================
// symptom_checker_migration.mjs
// Run: node symptom_checker_migration.mjs
// from backend/ folder
// ============================================
import { query } from './src/config/database.js';

console.log('🩺 Running Symptom Checker migration...\n');

await query(`
  CREATE TABLE IF NOT EXISTS symptom_checker_log (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id           INTEGER,
    symptoms             TEXT NOT NULL,
    duration             TEXT,
    severity             INTEGER,
    age                  TEXT,
    gender               TEXT,
    existing_conditions  TEXT,
    current_medications  TEXT,
    urgency              TEXT,
    summary              TEXT,
    raw_response         TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(user_id)
  )
`).then(() => console.log('  ✅ symptom_checker_log table created'))
  .catch(e => console.log('  ⏭  symptom_checker_log:', e.message.split('\n')[0]));

await query(`CREATE INDEX IF NOT EXISTS idx_sc_patient   ON symptom_checker_log(patient_id)`);
await query(`CREATE INDEX IF NOT EXISTS idx_sc_urgency   ON symptom_checker_log(urgency)`);
await query(`CREATE INDEX IF NOT EXISTS idx_sc_created   ON symptom_checker_log(created_at)`);
console.log('  ✅ Indexes created');

const r = await query('SELECT COUNT(*) as c FROM symptom_checker_log');
console.log(`\n🎉 Migration complete! symptom_checker_log rows: ${r.rows[0]?.c}`);