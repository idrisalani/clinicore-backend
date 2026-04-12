import fs from 'fs';
import path from 'path';

const fbase = '../frontend-web/src';

const read = (f) => fs.readFileSync(path.join(fbase, f), 'utf8');

// ── ConsultationForm ──────────────────────────────────────────────────────────
console.log('\n=== ConsultationForm.jsx — what it submits ===');
const cf = read('components/ConsultationForm.jsx');

// Find the submit/save object
const submitMatch = cf.match(/const\s+payload\s*=\s*\{([^}]+)\}/s) ||
                    cf.match(/createConsultation\((\{[^)]+\})\)/s) ||
                    cf.match(/await\s+\w+\(\s*(\{[\s\S]+?\})\s*\)/);

// Find all field names being sent
const fieldNames = [...cf.matchAll(/(\w+)\s*:\s*(formData|form|data)\??\.(\w+)/g)]
  .map(m => `${m[1]} ← ${m[3]}`);

console.log('Fields mapped in submit:');
fieldNames.forEach(f => console.log(' ', f));

// Check what formData keys exist
const initialState = cf.match(/const\s+(?:EMPTY_FORM|initialForm|emptyForm|formData)\s*=\s*\{([\s\S]+?)\};/);
if (initialState) {
  const keys = [...initialState[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
  console.log('\nForm initial state keys:', keys.join(', '));
}

// Find the actual submit call
const submitBlock = cf.match(/(?:handleSubmit|onSubmit|handleSave)[\s\S]{0,2000}?createConsultation/);
if (submitBlock) {
  console.log('\nSubmit block (first 600 chars):\n', submitBlock[0].slice(0, 600));
}

// ── LabOrderForm ──────────────────────────────────────────────────────────────
console.log('\n\n=== LabOrderForm.jsx — what it submits ===');
const lf = read('components/LabOrderForm.jsx');

const labFieldNames = [...lf.matchAll(/(\w+)\s*:\s*(formData|form|data)\??\.(\w+)/g)]
  .map(m => `${m[1]} ← ${m[3]}`);

console.log('Fields mapped in submit:');
labFieldNames.forEach(f => console.log(' ', f));

const labInitial = lf.match(/const\s+(?:EMPTY_FORM|initialForm|emptyForm|formData)\s*=\s*\{([\s\S]+?)\};/);
if (labInitial) {
  const keys = [...labInitial[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
  console.log('\nForm initial state keys:', keys.join(', '));
}

const labSubmit = lf.match(/(?:handleSubmit|onSubmit|handleSave)[\s\S]{0,2000}?createLabOrder/);
if (labSubmit) {
  console.log('\nSubmit block (first 600 chars):\n', labSubmit[0].slice(0, 600));
}