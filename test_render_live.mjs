// Tests the LIVE Render backend to see if the fix is deployed
const BASE = 'https://clinicore-backend-71qa.onrender.com/api/v1';

const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin1@clinicore.com', password: 'SecurePass123' }),
});
const { token, accessToken } = await loginRes.json();
const tok = token || accessToken;
const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` };

// Test WITHOUT consultation_date — should now succeed with fix deployed
console.log('=== Test: NO consultation_date (tests if Render has the fix) ===');
const r = await fetch(`${BASE}/consultations`, {
  method: 'POST', headers,
  body: JSON.stringify({
    patient_id: 3,
    chief_complaint: 'Tremor in knees',
    diagnosis: 'Primary diagnosis',
    treatment_plan: 'Exercises everyday',
  }),
});
console.log('Status:', r.status);
const d = await r.json();
console.log('Response:', JSON.stringify(d, null, 2));

if (r.status === 201) {
  console.log('\n✅ Render HAS the fix — consultation_date now optional');
  console.log('👉 Just do Ctrl+Shift+R in browser and try again');
} else {
  console.log('\n❌ Render does NOT have the fix yet — still redeploying');
  console.log('👉 Wait 1-2 more minutes and check Render dashboard');
}
