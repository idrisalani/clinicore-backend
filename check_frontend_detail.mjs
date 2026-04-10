import fs from 'fs';
import path from 'path';

const fbase = '../frontend-web/src';

const read = (filepath) => {
  const full = path.join(fbase, filepath);
  if (!fs.existsSync(full)) return `FILE NOT FOUND: ${filepath}`;
  return fs.readFileSync(full, 'utf8');
};

// Print exported functions from service files
for (const f of ['services/consultationService.js', 'services/labService.js']) {
  const content = read(f);
  const exports = [...content.matchAll(/export\s+(const|async function|function)\s+(\w+)/g)].map(m => m[2]);
  const imports = [...content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  console.log(`\n=== ${f} ===`);
  console.log('Exports:', exports.join(', ') || 'NONE FOUND');
  console.log('API base URL used:', content.match(/api\/v1[^\s'"`)]+/)?.[0] || 'check manually');
  console.log('First 400 chars:\n', content.slice(0, 400));
}

// Print imports used in the pages
for (const f of ['pages/ConsultationsPage.jsx', 'pages/LabPage.jsx']) {
  const content = read(f);
  const imports = content.split('\n').slice(0, 20).join('\n');
  console.log(`\n=== ${f} — top imports ===`);
  console.log(imports);
}
