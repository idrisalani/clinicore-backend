import fs from 'fs';

const file = '../frontend-web/src/components/ConsultationForm.jsx';
if (!fs.existsSync(file)) {
  console.log('❌ FILE NOT FOUND:', file);
  process.exit(1);
}
const content = fs.readFileSync(file, 'utf8');
console.log('File size:', content.length, 'chars');
console.log('Has PatientSelect:', content.includes('PatientSelect') ? '✅ YES' : '❌ NO — old version');
console.log('Has patient search:', content.includes('Search patient by name') ? '✅ YES' : '❌ NO');
console.log('Has old number input:', content.includes('type="number" name="patient_id"') ? '⚠️  YES — old version still there' : '✅ NO');
console.log('\nFirst 300 chars:\n', content.slice(0, 300));
