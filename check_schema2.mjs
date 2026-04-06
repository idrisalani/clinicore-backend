import { query } from './src/config/database.js';

for (const table of ['medications', 'medication_catalog']) {
  const result = await query(`PRAGMA table_info(${table})`);
  // Print raw so we can see the actual structure
  const rows = result.rows || result;
  console.log(`\n=== ${table} — raw first row ===`);
  console.log(JSON.stringify(rows[0], null, 2));
  console.log(`Total rows: ${rows.length}`);
  console.log('All column names:', rows.map(r => r.name || r.column_name || Object.values(r)[1]).join(', '));
}