const BASE = 'https://clinicore-backend-71qa.onrender.com/api/v1';

const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin1@clinicore.com', password: 'SecurePass123' }),
});
const { token, accessToken, access_token } = await loginRes.json();
const tok = token || accessToken || access_token;
const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` };

// Simulate exactly what the old form sends — patient_id as empty string
console.log('=== Test 1: empty patient_id (what old form sends) ===');
const r1 = await fetch(`${BASE}/lab`, {
  method: 'POST', headers,
  body: JSON.stringify({
    patient_id: '',           // empty string — old form bug
    test_type: 'CMP',
    test_name: 'Comprehensive Metabolic Panel',
    specimen_type: 'Urine',
    priority: 'Routine',
    ordered_date: '2026-04-11',
    expected_date: '2026-04-18',
    status: 'Ordered',
    test_code: 'LAB001',
    instructions: 'FAST',
    notes: 'Recommendations',
  }),
});
console.log('Status:', r1.status);
console.log('Body:', JSON.stringify(await r1.json(), null, 2));

// Send with valid patient_id
console.log('\n=== Test 2: valid patient_id = 1 ===');
const r2 = await fetch(`${BASE}/lab`, {
  method: 'POST', headers,
  body: JSON.stringify({
    patient_id: 1,
    test_type: 'CMP',
    test_name: 'Comprehensive Metabolic Panel',
    priority: 'Routine',
    ordered_date: '2026-04-11',
  }),
});
console.log('Status:', r2.status);
console.log('Body:', JSON.stringify(await r2.json(), null, 2));