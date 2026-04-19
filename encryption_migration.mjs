// ============================================
// encryption_migration.mjs
// Run: node encryption_migration.mjs  (from backend/)
//
// 1. Adds phone_hash / email_hash columns for searchable lookups
// 2. Can encrypt existing plaintext PHI in the database
//
// IMPORTANT: Run AFTER setting ENCRYPTION_KEY in your .env
// IMPORTANT: Take a database backup before running encrypt mode
//
// Modes:
//   node encryption_migration.mjs schema   — add hash columns only (safe)
//   node encryption_migration.mjs encrypt  — encrypt existing plaintext PHI
//   node encryption_migration.mjs verify   — check encryption status
// ============================================

// Load .env FIRST before any import reads process.env
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = resolve(__dirname, '.env');
try {
  const envFile = readFileSync(envPath, 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
  console.log('  \u2705 .env loaded from:', envPath);
} catch {
  console.warn('  \u26a0\ufe0f  No .env file found at', envPath, '\u2014 using system environment');
}

import { query } from './src/config/database.js';
import { encrypt, decrypt, isEncrypted, hashForSearch, PHI_FIELDS } from './src/utils/encryption.js';

const mode = process.argv[2] || 'schema';
console.log(`\n🔐 Encryption migration — mode: ${mode}\n`);

if (mode === 'schema') {
  // Add hash columns for searchable encrypted fields
  const schemaChanges = [
    // patients
    'ALTER TABLE patients ADD COLUMN phone_hash TEXT',
    'ALTER TABLE patients ADD COLUMN email_hash TEXT',
    'ALTER TABLE patients ADD COLUMN nin_hash TEXT',
    // users
    'ALTER TABLE users ADD COLUMN phone_hash TEXT',
  ];

  for (const sql of schemaChanges) {
    await query(sql).catch(e => {
      if (!e.message?.includes('duplicate column'))
        console.warn('  ⚠️ ', e.message.split('\n')[0]);
    });
  }

  // Indexes on hash columns for fast lookup
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash)',
    'CREATE INDEX IF NOT EXISTS idx_patients_email_hash ON patients(email_hash)',
    'CREATE INDEX IF NOT EXISTS idx_users_phone_hash    ON users(phone_hash)',
  ];
  for (const sql of indexes) await query(sql).catch(() => {});

  console.log('  ✅ Hash columns added');
  console.log('  ✅ Indexes created');
  console.log('\n  Next steps:');
  console.log('  1. Add ENCRYPTION_KEY to your .env (64 hex chars)');
  console.log('  2. Run: node encryption_migration.mjs verify');
  console.log('  3. When ready: node encryption_migration.mjs encrypt');
}

if (mode === 'verify') {
  const patients = await query('SELECT COUNT(*) as total FROM patients');
  const encrypted = await query("SELECT COUNT(*) as n FROM patients WHERE phone LIKE 'enc:v1:%'");
  const total = patients.rows[0]?.total || 0;
  const enc   = encrypted.rows[0]?.n || 0;
  console.log(`  Patients: ${total} total, ${enc} encrypted, ${total - enc} plaintext`);
  console.log(`  Encryption key set: ${!!process.env.ENCRYPTION_KEY}`);
  if (total > 0) console.log(`  Coverage: ${Math.round((enc/total)*100)}%`);
}

if (mode === 'encrypt') {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('  ❌ ENCRYPTION_KEY not set in environment');
    process.exit(1);
  }

  console.log('  ⚠️  Encrypting existing patient PHI...');
  console.log('  ⚠️  Ensure you have a database backup first!\n');

  const patients = await query('SELECT * FROM patients').then(r => r.rows || []);
  let updated = 0;

  for (const p of patients) {
    // Skip already-encrypted rows
    if (isEncrypted(p.phone) && isEncrypted(p.email)) { continue; }

    await query(
      `UPDATE patients SET
        phone                  = ?,
        phone_hash             = ?,
        email                  = ?,
        email_hash             = ?,
        address                = ?,
        insurance_policy_number= ?,
        emergency_contact_phone= ?
       WHERE patient_id = ?`,
      [
        p.phone                   ? encrypt(p.phone)                   : null,
        p.phone                   ? hashForSearch(p.phone)             : null,
        p.email                   ? encrypt(p.email)                   : null,
        p.email                   ? hashForSearch(p.email)             : null,
        p.address                 ? encrypt(p.address)                 : null,
        p.insurance_policy_number ? encrypt(p.insurance_policy_number) : null,
        p.emergency_contact_phone ? encrypt(p.emergency_contact_phone) : null,
        p.patient_id,
      ]
    );
    updated++;
  }

  console.log(`  ✅ Encrypted ${updated} patient records`);
  console.log('\n  Now redeploy your backend with the updated patientController.js');
}

console.log('\n🎉 Done!\n');