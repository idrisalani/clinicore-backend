const BASE = 'https://clinicore-backend-71qa.onrender.com/api/v1';

// Step 1 — login
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin1@clinicore.com', password: 'SecurePass123' }),
});
const loginData = await loginRes.json();
const token = loginData.token || loginData.accessToken || loginData.access_token;
console.log('Token:', token ? '✅ acquired' : '❌ failed', '\n');

const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

// Step 2 — get a real patient_id
const pRes = await fetch(`${BASE}/patients?limit=1`, { headers });
const pData = await pRes.json();
const patient_id = pData.patients?.[0]?.patient_id;
console.log('Patient ID to use:', patient_id, '\n');

// Step 3 — test consultation POST with minimal valid payload
console.log('=== POST /consultations ===');
const cRes = await fetch(`${BASE}/consultations`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    patient_id,
    consultation_date: new Date().toISOString().split('T')[0],
    chief_complaint: 'Test complaint',
    diagnosis: 'Test diagnosis',
    treatment_plan: 'Test treatment',
  }),
});
const cData = await cRes.json();
console.log('Status:', cRes.status);
console.log('Response:', JSON.stringify(cData, null, 2));

// Step 4 — test lab POST with minimal valid payload
console.log('\n=== POST /lab ===');
const lRes = await fetch(`${BASE}/lab`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    patient_id,
    test_type: 'Blood Test',
    test_name: 'Complete Blood Count',
    priority: 'Routine',
  }),
});
const lData = await lRes.json();
console.log('Status:', lRes.status);
console.log('Response:', JSON.stringify(lData, null, 2));