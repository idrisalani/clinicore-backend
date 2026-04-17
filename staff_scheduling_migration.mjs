// ============================================
// staff_scheduling_migration.mjs
// Run: node staff_scheduling_migration.mjs  (from backend/)
// ============================================
import { query } from './src/config/database.js';

console.log('📅 Running Staff Scheduling migration...\n');

// ── shift_templates ───────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS shift_templates (
    template_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    shift_type    TEXT NOT NULL DEFAULT 'Morning'
      CHECK(shift_type IN ('Morning','Afternoon','Night','On-call','Custom')),
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    duration_hours REAL,
    department    TEXT,
    color         TEXT DEFAULT '#0F6E56',
    description   TEXT,
    is_active     INTEGER DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ shift_templates'))
  .catch(e => console.log('  ⏭  shift_templates:', e.message.split('\n')[0]));

// ── staff_schedules ───────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS staff_schedules (
    schedule_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(user_id),
    template_id   INTEGER REFERENCES shift_templates(template_id),
    schedule_date DATE NOT NULL,
    shift_type    TEXT NOT NULL DEFAULT 'Morning'
      CHECK(shift_type IN ('Morning','Afternoon','Night','On-call','Off','Custom')),
    start_time    TEXT,
    end_time      TEXT,
    department    TEXT,
    location      TEXT,
    status        TEXT NOT NULL DEFAULT 'Scheduled'
      CHECK(status IN ('Scheduled','Confirmed','Completed','Absent','Cancelled')),
    notes         TEXT,
    check_in_time DATETIME,
    check_out_time DATETIME,
    created_by    INTEGER REFERENCES users(user_id),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, schedule_date, start_time)
  )
`).then(() => console.log('  ✅ staff_schedules'))
  .catch(e => console.log('  ⏭  staff_schedules:', e.message.split('\n')[0]));

// ── shift_swaps ───────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS shift_swaps (
    swap_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id    INTEGER NOT NULL REFERENCES users(user_id),
    target_id       INTEGER NOT NULL REFERENCES users(user_id),
    requester_schedule_id INTEGER REFERENCES staff_schedules(schedule_id),
    target_schedule_id    INTEGER REFERENCES staff_schedules(schedule_id),
    swap_date       DATE NOT NULL,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'Pending'
      CHECK(status IN ('Pending','Accepted','Rejected','Cancelled','Approved')),
    reviewed_by     INTEGER REFERENCES users(user_id),
    reviewed_at     DATETIME,
    review_notes    TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ shift_swaps'))
  .catch(e => console.log('  ⏭  shift_swaps:', e.message.split('\n')[0]));

// ── leave_requests ────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(user_id),
    leave_type    TEXT NOT NULL DEFAULT 'Annual'
      CHECK(leave_type IN ('Annual','Sick','Emergency','Maternity','Paternity','Study','Unpaid')),
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    days_count    INTEGER NOT NULL DEFAULT 1,
    reason        TEXT,
    status        TEXT NOT NULL DEFAULT 'Pending'
      CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
    reviewed_by   INTEGER REFERENCES users(user_id),
    reviewed_at   DATETIME,
    review_notes  TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ leave_requests'))
  .catch(e => console.log('  ⏭  leave_requests:', e.message.split('\n')[0]));

// ── indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_sched_user    ON staff_schedules(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sched_date    ON staff_schedules(schedule_date)',
  'CREATE INDEX IF NOT EXISTS idx_sched_dept    ON staff_schedules(department)',
  'CREATE INDEX IF NOT EXISTS idx_sched_status  ON staff_schedules(status)',
  'CREATE INDEX IF NOT EXISTS idx_swap_req      ON shift_swaps(requester_id)',
  'CREATE INDEX IF NOT EXISTS idx_swap_target   ON shift_swaps(target_id)',
  'CREATE INDEX IF NOT EXISTS idx_leave_user    ON leave_requests(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_leave_dates   ON leave_requests(start_date, end_date)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

// ── seed default shift templates ──────────────────────────────────────────────
const templates = [
  ['Morning Shift',   'Morning',   '07:00', '15:00', 8,   '#0F6E56'],
  ['Afternoon Shift', 'Afternoon', '15:00', '23:00', 8,   '#185FA5'],
  ['Night Shift',     'Night',     '23:00', '07:00', 8,   '#534AB7'],
  ['On-Call',         'On-call',   '08:00', '20:00', 12,  '#BA7517'],
];
for (const [name, type, start, end, hrs, color] of templates) {
  await query(
    `INSERT OR IGNORE INTO shift_templates (name, shift_type, start_time, end_time, duration_hours, color)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, type, start, end, hrs, color]
  ).catch(() => {});
}
console.log('  ✅ Default shift templates seeded');

const [t, s, sw, l] = await Promise.all([
  query('SELECT COUNT(*) as c FROM shift_templates'),
  query('SELECT COUNT(*) as c FROM staff_schedules'),
  query('SELECT COUNT(*) as c FROM shift_swaps'),
  query('SELECT COUNT(*) as c FROM leave_requests'),
]);
console.log(`\n🎉 Done! templates:${t.rows[0]?.c} schedules:${s.rows[0]?.c} swaps:${sw.rows[0]?.c} leaves:${l.rows[0]?.c}`);