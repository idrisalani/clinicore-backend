// Checks ALL JS bundles on Vercel for the PatientSelect component
const base = 'https://clinicore-frontend-web.vercel.app';

const pageRes = await fetch(base, { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await pageRes.text();

// Get all JS chunks
const scripts = [...html.matchAll(/["'](\/static\/js\/[^"']+\.js)["']/g)].map(m => m[1]);
const manifestMatch = html.match(/\/static\/js\/main\.[a-f0-9]+\.js/);
console.log(`Found ${scripts.length} script refs in HTML\n`);

let consultFound = false;
let labFound = false;

for (const src of scripts) {
  const url = `${base}${src}`;
  try {
    const r = await fetch(url);
    const code = await r.text();
    const hasConsult = code.includes('Search patient by name');
    const hasLab     = code.includes('Order Lab Test') || code.includes('LabOrderForm');
    if (hasConsult) { console.log(`✅ ConsultationForm (PatientSelect) found in: ${src}`); consultFound = true; }
    if (hasLab)     { console.log(`✅ LabOrderForm found in: ${src}`); labFound = true; }
  } catch (e) { console.log(`  Error fetching ${src}:`, e.message); }
}

console.log('\n── Summary ──');
console.log('ConsultationForm new version:', consultFound ? '✅ DEPLOYED' : '❌ NOT YET');
console.log('LabOrderForm:', labFound ? '✅ DEPLOYED' : '❌ NOT YET');

if (!consultFound) {
  console.log('\nVercel may be serving a stale build. The empty commit push should fix this.');
  console.log('Check https://vercel.com/dashboard for deploy status.');
}