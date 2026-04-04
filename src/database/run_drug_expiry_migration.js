// ============================================
// Drug Expiry Migration Script
// File: backend/src/database/run_drug_expiry_migration.js
// Run once: node src/database/run_drug_expiry_migration.js
// ============================================

import { query } from '../config/database.js';

const columns = [
  { name: 'stock_quantity',    def: "INTEGER DEFAULT 0"  },
  { name: 'reorder_level',     def: "INTEGER DEFAULT 10" },
  { name: 'expiry_date',       def: "DATE"               },
  { name: 'batch_number',      def: "TEXT"               },
  { name: 'supplier_name',     def: "TEXT"               },
  { name: 'supplier_phone',    def: "TEXT"               },
  { name: 'supplier_email',    def: "TEXT"               },
  { name: 'storage_location',  def: "TEXT"               },
  { name: 'last_restocked_at', def: "DATE"               },
];

const run = async () => {
  console.log('🔄 Running drug expiry migration...');

  for (const col of columns) {
    try {
      await query(`ALTER TABLE medication_catalog ADD COLUMN ${col.name} ${col.def}`, []);
      console.log(`  ✅ Added column: ${col.name}`);
    } catch (err) {
      if (err.message?.includes('duplicate column')) {
        console.log(`  ⏭️  Column already exists: ${col.name}`);
      } else {
        console.error(`  ❌ Error adding ${col.name}:`, err.message);
      }
    }
  }

  // Add indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_medication_expiry   ON medication_catalog(expiry_date)',
    'CREATE INDEX IF NOT EXISTS idx_medication_stock    ON medication_catalog(stock_quantity)',
    'CREATE INDEX IF NOT EXISTS idx_medication_supplier ON medication_catalog(supplier_name)',
  ];
  for (const idx of indexes) {
    try { await query(idx, []); } catch {}
  }

  console.log('✅ Drug expiry migration complete!');
  process.exit(0);
};

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });