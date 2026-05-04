// check_queue_schema.mjs
// Run from backend/: node check_queue_schema.mjs
import { dirname, resolve } from 'path';
import { fileURLToPath }    from 'url';
import { readFileSync }     from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  readFileSync(resolve(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i > 0) { const k = line.slice(0,i).trim(); if (!(k in process.env)) process.env[k] = line.slice(i+1).trim(); }
  });
} catch {}

import db from './src/config/database.js';

const all = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []))
);
const run = (sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function(err) { err ? rej(err) : res(this); })
);

// 1. Check queue table columns
const cols = await all("PRAGMA table_info('queue')");
if (cols.length === 0) {
  console.log('❌ queue table does NOT exist!');
  console.log('\nCreating queue table now...');
  await run(`
    CREATE TABLE IF NOT EXISTS queue (
      queue_id         INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id       INTEGER NOT NULL,
      appointment_id   INTEGER,
      doctor_id        INTEGER,
      queue_number     INTEGER NOT NULL,
      queue_date       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'Waiting',
      priority         TEXT NOT NULL DEFAULT 'Normal',
      reason_for_visit TEXT,
      notes            TEXT,
      created_by       INTEGER,
      check_in_time    TEXT,
      called_time      TEXT,
      start_time       TEXT,
      end_time         TEXT,
      wait_minutes     INTEGER,
      current_wait_minutes INTEGER,
      facility_id      INTEGER,
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ queue table created!');
} else {
  console.log('✅ queue table EXISTS with columns:');
  cols.forEach(c => console.log(`   ${c.cid}: ${c.name} (${c.type})`));
}

// 2. Test a check-in insert with dummy data
console.log('\n🧪 Testing INSERT...');
try {
  const result = await run(`
    INSERT INTO queue
      (patient_id, appointment_id, doctor_id, queue_number, queue_date,
       status, priority, reason_for_visit, notes, created_by, check_in_time)
    VALUES (?,?,?,?,?,'Waiting',?,?,?,?,?)
  `, [1, null, null, 9999, '2026-01-01', 'Normal', 'Test', null, null, new Date().toISOString()]);
  console.log('✅ INSERT succeeded, queue_id:', result.lastID);
  // Clean up test row
  await run("DELETE FROM queue WHERE queue_number = 9999 AND queue_date = '2026-01-01'");
  console.log('✅ Test row cleaned up');
} catch (e) {
  console.log('❌ INSERT FAILED:', e.message);
  console.log('   This is the 500 error cause!');
}

process.exit(0);