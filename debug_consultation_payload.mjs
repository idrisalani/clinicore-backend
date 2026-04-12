// Run from backend folder
// Simulates exactly what the new form sends — patient selected from dropdown
const BASE = 'https://clinicore-backend-71qa.onrender.com/api/v1';

const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin1@clinicore.com', password: 'SecurePass123' }),
});
const { token, accessToken } = await loginRes.json();
const tok = token || accessToken;
const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` };

// Test what the form sends when patient_id comes back as a number from PatientSelect
// The PatientSelect calls onChange(p.patient_id) — p.patient_id is an integer from the DB
console.log('=== Test: patient_id as INTEGER (what PatientSelect sends) ===');
const r1 = await fetch(`${BASE}/consultations`, {
  method: 'POST', headers,
  body: JSON.stringify({
    patient_id: 3,   // integer — Zainab Hassan
    consultation_date: '2026-04-12',
    chief_complaint: 'Tremor in knees',
    history_of_present_illness: 'None',
    past_medical_history: 'None',
    medications: 'Therapy',
    allergies: 'None',
    vital_signs_bp: '120/80',
    vital_signs_temp: '37.0',
    vital_signs_pulse: '72',
    vital_signs_respiration: '18',
    physical_examination: 'Physical condition ok!',
    diagnosis: 'Primary diagnosis',
    diagnosis_icd: 'J23.33',
    treatment_plan: 'Exercises everyday',
    medications_prescribed: 'None',
    procedures: 'N/A',
    follow_up_date: '2026-04-20',
    follow_up_notes: 'Follow up next week',
    referral_needed: 1,
    referral_to: 'Dentist',
    notes: 'Patient will revisit next week',
    status: 'Draft',
  }),
});
console.log('Status:', r1.status);
const d1 = await r1.json();
console.log('Response:', JSON.stringify(d1, null, 2));

// Now check what the consultationController expects for consultation_date
console.log('\n=== Test: consultation_date missing (common issue) ===');
const r2 = await fetch(`${BASE}/consultations`, {
  method: 'POST', headers,
  body: JSON.stringify({
    patient_id: 3,
    chief_complaint: 'Test',
    diagnosis: 'Test',
    treatment_plan: 'Test',
    // NO consultation_date — see if it's required
  }),
});
console.log('Status:', r2.status);
console.log('Response:', JSON.stringify(await r2.json(), null, 2));
