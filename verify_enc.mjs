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
import { query } from './src/config/database.js';
import { decrypt, isEncrypted } from './src/utils/encryption.js';
const rows = (await query('SELECT patient_id, first_name, phone FROM patients LIMIT 5')).rows;
rows.forEach(r => console.log(r.patient_id, r.first_name, isEncrypted(r.phone) ? '✅ encrypted →' + decrypt(r.phone) : '❌ plaintext: ' + r.phone));