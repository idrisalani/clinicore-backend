import { query } from './src/config/database.js';

const tables = ['medications', 'medication_catalog'];

for (const table of tables) {
  const result = await query(`PRAGMA table_info(${table})`);
  const cols = (result.rows || result).map(r => r.name);
  console.log(`\n=== ${table} (${cols.length} columns) ===`);
  console.log(cols.join(', '));
}