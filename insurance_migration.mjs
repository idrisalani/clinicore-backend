// ============================================
// insurance_migration.mjs
// Run once: node insurance_migration.mjs
// from backend/ folder
//
// Matches insuranceController.js (Document 8) exactly.
// ============================================
import { query } from './src/config/database.js';

console.log('🏥 Running Insurance Claims migration...\n');

// ── insurance_claims ──────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS insurance_claims (
    claim_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id              INTEGER NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    patient_id              INTEGER NOT NULL REFERENCES patients(patient_id),

    -- Provider & policy
    insurance_provider      TEXT NOT NULL,
    insurance_policy_number TEXT,
    insurance_group_number  TEXT,
    member_id               TEXT,

    -- Claim identification
    claim_number            TEXT UNIQUE,
    claim_date              DATE NOT NULL,
    diagnosis_codes         TEXT,
    procedure_codes         TEXT,

    -- Financials
    claim_amount            REAL NOT NULL DEFAULT 0,
    approved_amount         REAL DEFAULT 0,
    patient_liability       REAL DEFAULT 0,

    -- Status lifecycle
    status                  TEXT NOT NULL DEFAULT 'Submitted'
      CHECK(status IN ('Submitted','Under Review','Approved','Partially Approved',
                       'Rejected','Paid','Appealed')),
    status_date             DATE,
    response_date           DATE,
    payment_date            DATE,
    reference_number        TEXT,

    -- Outcome details
    rejection_reason        TEXT,
    appeal_notes            TEXT,
    notes                   TEXT,

    -- Admin
    created_by              INTEGER REFERENCES users(user_id),
    updated_by              INTEGER REFERENCES users(user_id),
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ insurance_claims table created'))
  .catch(e => console.log('  ⏭  insurance_claims:', e.message.split('\n')[0]));

// ── Indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_ins_invoice   ON insurance_claims(invoice_id)',
  'CREATE INDEX IF NOT EXISTS idx_ins_patient   ON insurance_claims(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_ins_status    ON insurance_claims(status)',
  'CREATE INDEX IF NOT EXISTS idx_ins_provider  ON insurance_claims(insurance_provider)',
  'CREATE INDEX IF NOT EXISTS idx_ins_date      ON insurance_claims(claim_date)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes created');

// ── Add insurance columns to invoices (safe to re-run) ───────────────────────
const invoiceAlterations = [
  "ALTER TABLE invoices ADD COLUMN insurance_provider       TEXT",
  "ALTER TABLE invoices ADD COLUMN insurance_policy_number  TEXT",
  "ALTER TABLE invoices ADD COLUMN insurance_claim_number   TEXT",
  "ALTER TABLE invoices ADD COLUMN insurance_claim_status   TEXT DEFAULT 'None'",
];
for (const sql of invoiceAlterations) {
  const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
  try { await query(sql); console.log(`  ✅ invoices.${col} added`); }
  catch (e) {
    if (e.message?.includes('duplicate')) console.log(`  ⏭  invoices.${col} exists`);
    else console.error(`  ❌ ${col}: ${e.message}`);
  }
}

// ── Nigerian HMO/NHIS providers reference ────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS insurance_providers (
    provider_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE,
    type          TEXT NOT NULL DEFAULT 'HMO',
    code          TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    is_active     INTEGER DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('\n  ✅ insurance_providers table created'))
  .catch(() => console.log('\n  ⏭  insurance_providers already exists'));

const providers = [
  ['LASHMA / Ilera Eko',  'LASHMA',  'LAG-001', '+234-700-000-0001', 'customercare@lashma.lagosstate.gov.ng'],
  ['NHIS Federal',         'NHIS',    'NHI-001', '+234-9-461-0742',   'info@nhis.gov.ng'],
  ['Hygeia HMO',           'HMO',     'HYG-001', '+234-1-280-5620',   'info@hygeiahmo.com'],
  ['Reliance HMO',         'HMO',     'REL-001', '+234-700-225-5477', 'info@reliancehmo.com'],
  ['AXA Mansard Health',   'HMO',     'AXA-001', '+234-1-279-0760',   'healthbusiness@axamansard.com'],
  ['Leadway Health',       'HMO',     'LWH-001', '+234-1-271-5550',   'health@leadway.com'],
  ['Total Health Trust',   'HMO',     'THT-001', '+234-1-780-0070',   'info@totalhealthtrust.com'],
  ['Clearline HMO',        'HMO',     'CLR-001', null,                'info@clearlinehmo.com'],
  ['Fountain Health',      'HMO',     'FNT-001', null,                'info@fountainhealth.com.ng'],
  ['Employer / Corporate', 'Other',   'EMP-001', null,                null],
];
for (const [name, type, code, phone, email] of providers) {
  await query(
    `INSERT OR IGNORE INTO insurance_providers (name,type,code,contact_phone,contact_email) VALUES (?,?,?,?,?)`,
    [name, type, code, phone, email]
  ).catch(() => {});
}
console.log('  ✅ Nigerian providers seeded');

const r = await query('SELECT COUNT(*) as c FROM insurance_claims');
console.log(`\n🎉 Migration complete! insurance_claims rows: ${r.rows[0]?.c}`);
