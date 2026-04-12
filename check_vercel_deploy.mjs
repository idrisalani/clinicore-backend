const res = await fetch('https://clinicore-frontend-web.vercel.app', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const html = await res.text();
const scripts = [...html.matchAll(/src="(\/static\/js\/[^"]+\.js)"/g)].map(m => m[1]);
console.log(`Found ${scripts.length} JS bundles\n`);

let found = false;
for (const src of scripts) {
  const url = `https://clinicore-frontend-web.vercel.app${src}`;
  try {
    const r = await fetch(url);
    const code = await r.text();
    if (code.includes('Search patient by name')) {
      console.log('✅ NEW form IS live — PatientSelect found!');
      found = true; break;
    }
  } catch (e) { console.log('Error fetching bundle:', e.message); }
}
if (!found) console.log('❌ OLD form still live — Vercel deploy not complete yet.\nCheck https://vercel.com/dashboard and wait for green "Ready" status.');
