// ============================================
// Database Auto-Initialization Wrapper
// File: backend/src/database/autoInit.js
// ============================================
import db from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helper: run ALTER TABLE, silently ignore duplicate column errors ───────────
const safeAlter = (sql) => new Promise((resolve) => {
  db.run(sql, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.warn('⚠️  Migration warning:', err.message);
    }
    resolve();
  });
});

export function checkTablesExist() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      (err, tables) => {
        if (err) reject(err);
        resolve(tables && tables.length > 0);
      }
    );
  });
}

// ── medication_catalog inventory columns ──────────────────────────────────────
async function ensureInventoryColumns() {
  const cols = [
    "ALTER TABLE medication_catalog ADD COLUMN stock_quantity    INTEGER DEFAULT 0",
    "ALTER TABLE medication_catalog ADD COLUMN reorder_level     INTEGER DEFAULT 10",
    "ALTER TABLE medication_catalog ADD COLUMN expiry_date       TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN batch_number      TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_name     TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_phone    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_email    TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN storage_location  TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN last_restocked_at TEXT",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ medication_catalog inventory columns verified');
}

// ── activity_logs missing columns ─────────────────────────────────────────────
async function ensureActivityLogsColumns() {
  const cols = [
    "ALTER TABLE activity_logs ADD COLUMN resource_type TEXT",
    "ALTER TABLE activity_logs ADD COLUMN resource_id   INTEGER",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ activity_logs columns verified');
}

// ── appointments telemedicine columns ─────────────────────────────────────────
async function ensureAppointmentColumns() {
  const cols = [
    "ALTER TABLE appointments ADD COLUMN appointment_type TEXT DEFAULT 'In-Person'",
    "ALTER TABLE appointments ADD COLUMN meeting_url      TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_room_id  TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_token    TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_password TEXT",
    "ALTER TABLE appointments ADD COLUMN meeting_provider TEXT DEFAULT 'daily'",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ appointments columns verified');
}

// ── invoices insurance columns ────────────────────────────────────────────────
async function ensureInvoiceColumns() {
  const cols = [
    "ALTER TABLE invoices ADD COLUMN insurance_provider       TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_policy_number  TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_number   TEXT",
    "ALTER TABLE invoices ADD COLUMN insurance_claim_status   TEXT DEFAULT 'None'",
  ];
  for (const sql of cols) await safeAlter(sql);
  console.log('✅ invoices columns verified');
}

// ── Main auto-initialize ──────────────────────────────────────────────────────
export async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();

    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization');
    } else {
      console.log('🔧 Database tables not found - initializing...');
      const initScriptPath = path.join(__dirname, 'init_SIMPLE.js');
      if (!fs.existsSync(initScriptPath)) {
        throw new Error('init_SIMPLE.js not found at ' + initScriptPath);
      }
      const { initializeDatabase } = await import('./init_SIMPLE.js');
      await initializeDatabase();
      console.log('✅ Database auto-initialized successfully!');
    }

    // Always run all column migrations — safe on every restart
    await ensureInventoryColumns();
    await ensureActivityLogsColumns();
    await ensureAppointmentColumns();
    await ensureInvoiceColumns();

    return true;
  } catch (err) {
    console.error('❌ Database auto-initialization failed:', err.message);
    return false;
  }
}

export async function initDatabaseOnStartup() {
  console.log('🔍 Checking database status...');
  try {
    const initialized = await autoInitializeDatabase();
    if (initialized) {
      console.log('✅ Database ready for use');
      return true;
    } else {
      console.log('⚠️  Database check completed with warnings');
      return false;
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    return false;
  }
}