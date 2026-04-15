// ============================================
// activity_logs_fix.mjs
// Run ONCE: node activity_logs_fix.mjs  (from backend/)
// Adds missing resource_type column to activity_logs
// ============================================
import { query } from './src/config/database.js';

console.log('🔧 Fixing activity_logs table...\n');

const columns = [
  "ALTER TABLE activity_logs ADD COLUMN resource_type TEXT",
  "ALTER TABLE activity_logs ADD COLUMN resource_id   INTEGER",
];

for (const sql of columns) {
  const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
  try {
    await query(sql);
    console.log(`  ✅ Added: ${col}`);
  } catch (e) {
    if (e.message?.includes('duplicate column')) console.log(`  ⏭  Exists: ${col}`);
    else console.error(`  ❌ ${col}: ${e.message}`);
  }
}

console.log('\n🎉 Done!');