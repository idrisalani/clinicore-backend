import { query } from './src/config/database.js';

// Test backend by directly hitting the DB layer the same way controllers do
const BASE_URL = 'http://localhost:5000/api/v1';

console.log('\n=== TESTING CLINICORE API ENDPOINTS ===\n');

// First login to get a token
let token = '';
try {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin1@clinicore.com', password: 'SecurePass123' }),
  });
  const loginData = await loginRes.json();
  token = loginData.token || loginData.accessToken || loginData.access_token || '';
  console.log(token ? `✅ Login OK — token acquired` : `❌ Login failed: ${JSON.stringify(loginData)}`);
} catch (e) {
  console.log(`❌ Login error: ${e.message} — is the backend running? (npm run dev)`);
  process.exit(1);
}

const get = async (path, label) => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    const ok = res.status >= 200 && res.status < 300;
    const keys = Object.keys(data).join(', ');
    console.log(`${ok ? '✅' : '❌'} ${label.padEnd(40)} HTTP ${res.status}  keys: [${keys}]`);
    return data;
  } catch (e) {
    console.log(`❌ ${label.padEnd(40)} ERROR: ${e.message}`);
  }
};

console.log('\n── Phase 4: Consultations ──');
await get('/consultations',               'GET /consultations');
await get('/consultations/stats/overview','GET /consultations/stats/overview');

console.log('\n── Phase 5: Laboratory ──');
await get('/lab',               'GET /lab');
await get('/lab/stats/overview','GET /lab/stats/overview');

console.log('\n── Pharmacy (existing) ──');
await get('/pharmacy/prescriptions',          'GET /pharmacy/prescriptions');
await get('/pharmacy/medications',            'GET /pharmacy/medications');
await get('/pharmacy/medications/expiry',     'GET /pharmacy/medications/expiry');
await get('/pharmacy/medications/low-stock',  'GET /pharmacy/medications/low-stock');
await get('/pharmacy/stats/overview',         'GET /pharmacy/stats/overview');

console.log('\n── Billing (existing) ──');
await get('/billing/invoices',        'GET /billing/invoices');
await get('/billing/stats/overview',  'GET /billing/stats/overview');

console.log('\n── Core ──');
await get('/patients',      'GET /patients');
await get('/appointments',  'GET /appointments');

console.log('\n=== DONE ===\n');
