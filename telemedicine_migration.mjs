// ============================================
// telemedicine_migration.mjs
// Run once: node telemedicine_migration.mjs
// from backend/ folder
// ============================================
import { query } from './src/config/database.js';

console.log('📹 Running Telemedicine migration...\n');

// Add telemedicine columns to appointments
const alterations = [
  "ALTER TABLE appointments ADD COLUMN appointment_type TEXT DEFAULT 'In-Person'",
  "ALTER TABLE appointments ADD COLUMN meeting_url      TEXT",
  "ALTER TABLE appointments ADD COLUMN meeting_room_id  TEXT",
  "ALTER TABLE appointments ADD COLUMN meeting_token    TEXT",
  "ALTER TABLE appointments ADD COLUMN meeting_password TEXT",
  "ALTER TABLE appointments ADD COLUMN meeting_provider TEXT DEFAULT 'daily'",
];

for (const sql of alterations) {
  const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
  try {
    await query(sql);
    console.log(`  ✅ Added: ${col}`);
  } catch (e) {
    if (e.message?.includes('duplicate column')) console.log(`  ⏭  Exists: ${col}`);
    else console.error(`  ❌ ${col}: ${e.message}`);
  }
}

// Standalone telemedicine_sessions table for detailed call tracking
await query(`
  CREATE TABLE IF NOT EXISTS telemedicine_sessions (
    session_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id    INTEGER NOT NULL REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id        INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id         INTEGER NOT NULL REFERENCES users(user_id),

    -- Room details (Daily.co)
    room_name         TEXT NOT NULL UNIQUE,
    room_url          TEXT NOT NULL,
    doctor_token      TEXT,
    patient_token     TEXT,
    privacy           TEXT DEFAULT 'private',

    -- Session lifecycle
    status            TEXT DEFAULT 'Scheduled'
      CHECK(status IN ('Scheduled','Active','Completed','Cancelled','No Show')),
    scheduled_at      DATETIME,
    started_at        DATETIME,
    ended_at          DATETIME,
    duration_minutes  INTEGER,

    -- Clinical output
    consultation_id   INTEGER REFERENCES consultations(consultation_id),
    notes             TEXT,

    -- Admin
    created_by        INTEGER REFERENCES users(user_id),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('\n  ✅ telemedicine_sessions table created'))
  .catch(e => console.log(`\n  ⏭  telemedicine_sessions: ${e.message.split('\n')[0]}`));

await query(`CREATE INDEX IF NOT EXISTS idx_tele_appointment ON telemedicine_sessions(appointment_id)`);
await query(`CREATE INDEX IF NOT EXISTS idx_tele_patient    ON telemedicine_sessions(patient_id)`);
await query(`CREATE INDEX IF NOT EXISTS idx_tele_doctor     ON telemedicine_sessions(doctor_id)`);
await query(`CREATE INDEX IF NOT EXISTS idx_tele_status     ON telemedicine_sessions(status)`);

const r = await query('SELECT COUNT(*) as c FROM telemedicine_sessions');
console.log(`\n🎉 Migration complete! telemedicine_sessions rows: ${r.rows[0]?.c}`);