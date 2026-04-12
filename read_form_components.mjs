import fs from 'fs';
import path from 'path';

const fbase = '../frontend-web/src';
const read = (f) => fs.readFileSync(path.join(fbase, f), 'utf8');

// Print just the submit handler from each form
for (const [file, label] of [
  ['components/ConsultationForm.jsx', 'ConsultationForm'],
  ['components/LabOrderForm.jsx',     'LabOrderForm'],
]) {
  const content = read(file);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label} — full file (${content.length} chars)`);
  console.log('='.repeat(60));
  console.log(content);
}