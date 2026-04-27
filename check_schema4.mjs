// check_schema.mjs — run from backend/
// node check_schema.mjs
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  readFileSync(resolve(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i > 0) { const k = line.slice(0,i).trim(); if (!(k in process.env)) process.env[k] = line.slice(i+1).trim(); }
  });
} catch {}

import db from './src/config/database.js';

// Use raw db.all for PRAGMA — works regardless of query wrapper shape
const cols = await new Promise((resolve, reject) =>
  db.all('PRAGMA table_info(patients)', (err, rows) => err ? reject(err) : resolve(rows || []))
);

console.log('\n✅ patients table columns:\n');
cols.forEach(c => console.log(`  ${String(c.cid).padStart(2)}: ${c.name.padEnd(35)} ${c.type}`));
console.log(`\nTotal: ${cols.length} columns`);

// Also check if patient_number exists
const hasPN = cols.some(c => c.name === 'patient_number');
console.log(`\npatient_number column exists: ${hasPN ? '✅ YES' : '❌ NO — this is why INSERT fails'}`);
process.exit(0);