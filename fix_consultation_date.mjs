import fs from 'fs';

const file = './src/controllers/consultationController.js';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Make consultation_date optional with default today
const before1 = `consultation_date: Joi.date().required().messages({
    'date.base': 'Consultation date is required',
  }),`;

const after1 = `consultation_date: Joi.date().optional().default(() => new Date()),`;

// Try variant spellings
const variants = [
  `consultation_date: Joi.date().required().messages({
    'date.base': 'Consultation date is required',
  }),`,
  `consultation_date: Joi.date().required(),`,
  `consultation_date: Joi.date().required()`,
];

let fixed = false;
for (const v of variants) {
  if (content.includes(v)) {
    content = content.replace(v, `consultation_date: Joi.date().optional().default(() => new Date()),`);
    console.log('✅ Fixed consultation_date — made optional with default');
    fixed = true;
    break;
  }
}

if (!fixed) {
  // Show what's around consultation_date
  const idx = content.indexOf('consultation_date');
  if (idx >= 0) {
    console.log('⚠️  Could not auto-fix. Context around consultation_date:');
    console.log(content.slice(idx - 20, idx + 150));
  } else {
    console.log('❌ consultation_date not found in controller');
  }
} else {
  fs.writeFileSync(file, content);
  console.log('✅ File saved');
}