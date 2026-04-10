import { query } from './src/config/database.js';

console.log('\n=== CHECKING CLINICORE DEPLOYMENT STATUS ===\n');

// 1. Check all tables
const tables = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('📦 Tables in DB:', (tables.rows || []).map(r => r.name).join(', '));

// 2. Check consultations table
try {
  const cols = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='consultations'");
  const sql = cols.rows?.[0]?.sql || 'NOT FOUND';
  console.log('\n🔬 consultations table:', sql.includes('consultation_id') ? '✅ EXISTS' : '❌ MISSING');
} catch(e) { console.log('\n🔬 consultations table: ❌ MISSING'); }

// 3. Check lab_orders table
try {
  const cols = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='lab_orders'");
  const sql = cols.rows?.[0]?.sql || 'NOT FOUND';
  console.log('🧪 lab_orders table:', sql.includes('lab_order_id') ? '✅ EXISTS' : '❌ MISSING');
} catch(e) { console.log('🧪 lab_orders table: ❌ MISSING'); }

// 4. Check lab_results table
try {
  const cols = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='lab_results'");
  const sql = cols.rows?.[0]?.sql || 'NOT FOUND';
  console.log('🔭 lab_results table:', sql.includes('result_id') ? '✅ EXISTS' : '❌ MISSING');
} catch(e) { console.log('🔭 lab_results table: ❌ MISSING'); }

// 5. Check row counts
const counts = ['consultations','lab_orders','lab_results','prescriptions','medication_catalog','patients','appointments'];
console.log('\n📊 Row counts:');
for (const t of counts) {
  try {
    const r = await query(`SELECT COUNT(*) as c FROM ${t}`);
    console.log(`  ${t}: ${r.rows?.[0]?.c ?? 0} rows`);
  } catch(e) {
    console.log(`  ${t}: ❌ table missing`);
  }
}

console.log('\n=== DONE ===\n');