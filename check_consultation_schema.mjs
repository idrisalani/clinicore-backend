import fs from 'fs';

const controller = fs.readFileSync('./src/controllers/consultationController.js', 'utf8');

// Find the Joi schema
const schemaMatch = controller.match(/consultation_date[\s\S]{0,200}/);
console.log('consultation_date schema definition:');
console.log(schemaMatch?.[0]?.slice(0, 300));

// Find full schema block
const fullSchema = controller.match(/const consultationSchema[\s\S]+?}\);/);
console.log('\nFull schema (first 800 chars):');
console.log(fullSchema?.[0]?.slice(0, 800));