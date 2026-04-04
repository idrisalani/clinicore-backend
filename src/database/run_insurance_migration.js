// ============================================
// Insurance Claims Migration Script
// File: backend/src/database/run_insurance_migration.js
// Run once: node src/database/run_insurance_migration.js
// ============================================

import { query } from '../config/database.js';

const invoiceColumns = [
  { name: 'insurance_provider',        def: 'TEXT'             },
  { name: 'insurance_policy_number',   def: 'TEXT'             },
  { name: 'insurance_claim_number',    def: 'TEXT'             },
  { name: 'insurance_claim_amount',    def: 'REAL DEFAULT 0'   },
  { name: 'insurance_claim_status',    def: "TEXT DEFAULT 'None'" },
  { name: 'insurance_claim_date',      def: 'DATE'             },
  { name: 'insurance_approved_amount', def: 'REAL DEFAULT 0'   },
  { name: 'insurance_rejection_reason',def: 'TEXT'             },
  { name: 'insurance_notes',           def: 'TEXT'             },
  { name: 'patient_liability',         def: 'REAL DEFAULT 0'   },
];

const run = async () => {
  console.log('🔄 Running insurance claims migration...\n');

  // 1. Add columns to invoices
  console.log('📋 Adding insurance columns to invoices table...');
  for (const col of invoiceColumns) {
    try {
      await query(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.def}`, []);
      console.log(`  ✅ Added: ${col.name}`);
    } catch (err) {
      if (err.message?.includes('duplicate column')) {
        console.log(`  ⏭️  Already exists: ${col.name}`);
      } else {
        console.error(`  ❌ Error: ${col.name} — ${err.message}`);
      }
    }
  }

  // 2. Create insurance_claims table
  console.log('\n📋 Creating insurance_claims table...');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS insurance_claims (
        claim_id                INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id              INTEGER NOT NULL,
        patient_id              INTEGER NOT NULL,
        insurance_provider      TEXT NOT NULL,
        insurance_policy_number TEXT,
        insurance_group_number  TEXT,
        member_id               TEXT,
        claim_number            TEXT UNIQUE,
        claim_date              DATE NOT NULL,
        claim_amount            REAL NOT NULL,
        approved_amount         REAL DEFAULT 0,
        patient_liability       REAL DEFAULT 0,
        status                  TEXT DEFAULT 'Submitted',
        status_date             DATE,
        rejection_reason        TEXT,
        appeal_notes            TEXT,
        response_date           DATE,
        payment_date            DATE,
        reference_number        TEXT,
        notes                   TEXT,
        diagnosis_codes         TEXT,
        procedure_codes         TEXT,
        created_by              INTEGER,
        created_at              TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_by              INTEGER,
        updated_at              TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
      )
    `, []);
    console.log('  ✅ insurance_claims table created');
  } catch (err) {
    console.error('  ❌ Error creating table:', err.message);
  }

  // 3. Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_claims_invoice_id ON insurance_claims(invoice_id)',
    'CREATE INDEX IF NOT EXISTS idx_claims_patient_id ON insurance_claims(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_claims_status     ON insurance_claims(status)',
    'CREATE INDEX IF NOT EXISTS idx_claims_claim_date ON insurance_claims(claim_date)',
    'CREATE INDEX IF NOT EXISTS idx_claims_provider   ON insurance_claims(insurance_provider)',
  ];
  for (const idx of indexes) {
    try { await query(idx, []); } catch {}
  }
  console.log('  ✅ Indexes created');

  console.log('\n✅ Insurance claims migration complete!');
  process.exit(0);
};

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });