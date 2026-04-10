import fs from 'fs';
import path from 'path';

const base = './src';

const check = (filepath, label, searchTerms) => {
  const full = path.join(base, filepath);
  if (!fs.existsSync(full)) {
    console.log(`❌ MISSING: ${label} (${filepath})`);
    return;
  }
  const content = fs.readFileSync(full, 'utf8');
  const found = searchTerms.filter(t => content.includes(t));
  const missing = searchTerms.filter(t => !content.includes(t));
  if (missing.length === 0) {
    console.log(`✅ OK:      ${label}`);
  } else {
    console.log(`⚠️  PARTIAL: ${label}`);
    console.log(`   Found:   ${found.join(', ')}`);
    console.log(`   Missing: ${missing.join(', ')}`);
  }
};

console.log('\n=== BACKEND FILES ===');
check('app.js',                          'app.js (routes registered)',       ['consultationRoutes','labRoutes','pharmacyRoutes','billingRoutes']);
check('routes/consultationRoutes.js',    'consultationRoutes.js',            ['getAllConsultations','createConsultation','getConsultationStats']);
check('routes/labRoutes.js',             'labRoutes.js',                     ['getAllLabOrders','createLabOrder','addLabResult']);
check('routes/pharmacyRoutes.js',        'pharmacyRoutes.js',                ['getAllPrescriptions','getMedicationExpiry','getLowStockMedications']);
check('routes/billingRoutes.js',         'billingRoutes.js',                 ['getAllInvoices','createInvoice','recordPayment']);
check('controllers/consultationController.js', 'consultationController.js', ['getAllConsultations','createConsultation','getConsultationStats']);
check('controllers/labController.js',    'labController.js',                 ['getAllLabOrders','createLabOrder','addLabResult','getLabStats']);

console.log('\n=== FRONTEND FILES ===');
const fbase = '../frontend-web/src';
const fcheck = (filepath, label, searchTerms) => {
  const full = path.join(fbase, filepath);
  if (!fs.existsSync(full)) {
    console.log(`❌ MISSING: ${label} (${filepath})`);
    return;
  }
  const content = fs.readFileSync(full, 'utf8');
  const missing = searchTerms.filter(t => !content.includes(t));
  if (missing.length === 0) {
    console.log(`✅ OK:      ${label}`);
  } else {
    console.log(`⚠️  PARTIAL: ${label} — missing: ${missing.join(', ')}`);
  }
};

fcheck('App.js',                          'App.js (routes)',                  ['/consultations','/lab','/pharmacy','/billing']);
fcheck('pages/ConsultationsPage.jsx',     'ConsultationsPage.jsx',            ['ConsultationsPage','getAllConsultations']);
fcheck('pages/LabPage.jsx',               'LabPage.jsx',                      ['LabPage','getAllLabOrders']);
fcheck('pages/PharmacyPage.jsx',          'PharmacyPage.jsx',                 ['PharmacyPage']);
fcheck('pages/BillingPage.jsx',           'BillingPage.jsx',                  ['BillingPage']);
fcheck('services/consultationService.js', 'consultationService.js',           ['getAllConsultations','createConsultation']);
fcheck('services/labService.js',          'labService.js',                    ['getAllLabOrders','createLabOrder']);

console.log('\n=== DONE ===\n');
