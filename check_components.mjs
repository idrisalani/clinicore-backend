import fs from 'fs';
import path from 'path';

const fbase = '../frontend-web/src';

const check = (filepath, label, terms) => {
  const full = path.join(fbase, filepath);
  if (!fs.existsSync(full)) { console.log(`❌ MISSING: ${label}`); return null; }
  const c = fs.readFileSync(full, 'utf8');
  const missing = terms.filter(t => !c.includes(t));
  console.log(`${missing.length === 0 ? '✅' : '⚠️ '} ${label}${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
  return c;
};

console.log('\n=== COMPONENTS ===');
check('components/ConsultationForm.jsx',  'ConsultationForm.jsx',   ['patient_id','diagnosis','treatment_plan','chief_complaint']);
check('components/ConsultationNotes.jsx', 'ConsultationNotes.jsx',  ['consultation','diagnosis','vital_signs_bp']);
check('components/LabOrderForm.jsx',      'LabOrderForm.jsx',       ['test_name','priority','patient_id']);
check('components/LabResults.jsx',        'LabResults.jsx',         ['result_value','reference_range','result_status']);

console.log('\n=== PAGES — key logic ===');
const cp = check('pages/ConsultationsPage.jsx', 'ConsultationsPage.jsx', ['getConsultations','getConsultationStats','useCallback','useEffect']);
if (cp) {
  // Check for common ESLint issues
  const hasEmptyDeps = cp.includes('useEffect(() =>') && cp.includes('}, [])');
  const hasConfirmDialog = cp.includes('window.confirm') || cp.includes('confirm(');
  console.log(`   useEffect with empty deps: ${hasEmptyDeps ? '⚠️  check deps' : '✅ ok'}`);
  console.log(`   window.confirm usage:      ${hasConfirmDialog ? '⚠️  should use ConfirmModal' : '✅ none'}`);
}

const lp = check('pages/LabPage.jsx', 'LabPage.jsx', ['getLabOrders','getLabStats','useCallback','useEffect']);
if (lp) {
  const hasConfirmDialog = lp.includes('window.confirm') || lp.includes('confirm(');
  console.log(`   window.confirm usage:      ${hasConfirmDialog ? '⚠️  should use ConfirmModal' : '✅ none'}`);
}

console.log('\n=== SIDEBAR — nav links ===');
const sb = check('components/Sidebar.jsx', 'Sidebar.jsx', ['/consultations','/lab','/pharmacy','/billing']);
if (sb) {
  const navItems = [...sb.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  console.log('   Nav paths found:', navItems.join(', '));
}

console.log('\n=== autoInit.js — Render migration ===');
const ai = check('../src/database/autoInit.js', 'autoInit.js', ['ensureInventoryColumns','stock_quantity','medication_catalog']);
// Check from backend dir
const aiFull = path.join('.', 'src/database/autoInit.js');
if (fs.existsSync(aiFull)) {
  const aic = fs.readFileSync(aiFull, 'utf8');
  const hasInv = aic.includes('stock_quantity');
  console.log(`   inventory migration present: ${hasInv ? '✅ YES' : '❌ NO — Render will be missing columns'}`);
}

console.log('\n=== DONE ===\n');
