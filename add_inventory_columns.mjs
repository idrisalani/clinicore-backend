// ============================================
// Migration: Add inventory columns to medication_catalog
// File: backend/add_inventory_columns.mjs
// Run once: node add_inventory_columns.mjs
// ============================================

import { query } from './src/config/database.js';

const columns = [
  { name: 'stock_quantity',    def: 'INTEGER DEFAULT 0' },
  { name: 'reorder_level',     def: 'INTEGER DEFAULT 10' },
  { name: 'expiry_date',       def: 'TEXT' },
  { name: 'batch_number',      def: 'TEXT' },
  { name: 'supplier_name',     def: 'TEXT' },
  { name: 'supplier_phone',    def: 'TEXT' },
  { name: 'supplier_email',    def: 'TEXT' },
  { name: 'storage_location',  def: 'TEXT' },
  { name: 'last_restocked_at', def: 'TEXT' },
];

console.log('Adding inventory columns to medication_catalog...\n');

for (const col of columns) {
  try {
    await query(`ALTER TABLE medication_catalog ADD COLUMN ${col.name} ${col.def}`);
    console.log(`✅ Added: ${col.name}`);
  } catch (err) {
    if (err.message?.includes('duplicate column')) {
      console.log(`⏭️  Already exists: ${col.name}`);
    } else {
      console.error(`❌ Failed: ${col.name} —`, err.message);
    }
  }
}

// Verify
const schema = await query(
  `SELECT sql FROM sqlite_master WHERE type='table' AND name='medication_catalog'`
);
console.log('\n✅ Migration complete. Updated schema:');
console.log(schema.rows[0].sql);