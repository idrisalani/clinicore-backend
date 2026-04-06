import { query } from './src/config/database.js';

for (const table of ['medications', 'medication_catalog']) {
  // Use SELECT instead of PRAGMA — works with any query() wrapper
  const result = await query(
    `SELECT * FROM ${table} LIMIT 1`
  );
  console.log(`\n=== ${table} ===`);
  console.log('Raw result keys:', Object.keys(result));
  
  // Try every possible location the rows might be
  const row = result.rows?.[0] ?? result[0] ?? null;
  if (row) {
    console.log('Columns:', Object.keys(row).join(', '));
  } else {
    // Table is empty — get column names from sqlite_master instead
    const schema = await query(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    const sql = schema.rows?.[0]?.sql ?? schema[0]?.sql ?? 'not found';
    console.log('Table SQL:', sql);
  }
}