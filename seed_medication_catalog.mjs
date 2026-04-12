// ============================================
// Seed: medication_catalog with realistic Nigerian pharmacy data
// File: backend/seed_medication_catalog.mjs
// Run: node seed_medication_catalog.mjs
// ============================================

import { query } from './src/config/database.js';

const today = new Date();
const date = (daysFromNow) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

const medications = [
  // ── EXPIRED (for Drug Expiry page demo) ────────────────────────────────────
  {
    generic_name: 'Amoxicillin', brand_name: 'Amoxil', drug_code: 'AMX-500',
    drug_class: 'Antibiotic', strength: '500mg', unit: 'capsule',
    default_dosage: '1 capsule', default_frequency: 'Three times daily',
    unit_cost: 150, stock_quantity: 48, reorder_level: 20,
    expiry_date: date(-45), batch_number: 'BN2024-001',
    supplier_name: 'Fidson Healthcare', supplier_phone: '+234-802-000-0001',
    storage_location: 'Shelf A1', is_active: 1
  },
  {
    generic_name: 'Metronidazole', brand_name: 'Flagyl', drug_code: 'MTZ-400',
    drug_class: 'Antibiotic', strength: '400mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Three times daily',
    unit_cost: 80, stock_quantity: 120, reorder_level: 30,
    expiry_date: date(-10), batch_number: 'BN2024-002',
    supplier_name: 'Emzor Pharmaceuticals', supplier_phone: '+234-802-000-0002',
    storage_location: 'Shelf A2', is_active: 1
  },

  // ── EXPIRING SOON (within 30 days) ─────────────────────────────────────────
  {
    generic_name: 'Artemether/Lumefantrine', brand_name: 'Coartem', drug_code: 'ACT-80',
    drug_class: 'Antimalarial', strength: '80/480mg', unit: 'tablet',
    default_dosage: '4 tablets', default_frequency: 'Twice daily for 3 days',
    unit_cost: 1800, stock_quantity: 35, reorder_level: 10,
    expiry_date: date(12), batch_number: 'BN2025-010',
    supplier_name: 'Novartis Nigeria', supplier_phone: '+234-802-000-0010',
    storage_location: 'Shelf B1', is_active: 1
  },
  {
    generic_name: 'Ciprofloxacin', brand_name: 'Ciproxin', drug_code: 'CIP-500',
    drug_class: 'Antibiotic', strength: '500mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Twice daily',
    unit_cost: 200, stock_quantity: 60, reorder_level: 20,
    expiry_date: date(20), batch_number: 'BN2025-011',
    supplier_name: 'Pfizer Nigeria', supplier_phone: '+234-802-000-0011',
    storage_location: 'Shelf A3', is_active: 1
  },
  {
    generic_name: 'Diclofenac', brand_name: 'Voltaren', drug_code: 'DCL-50',
    drug_class: 'NSAID', strength: '50mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Twice daily with food',
    unit_cost: 60, stock_quantity: 200, reorder_level: 50,
    expiry_date: date(25), batch_number: 'BN2025-012',
    supplier_name: 'May & Baker Nigeria', supplier_phone: '+234-802-000-0012',
    storage_location: 'Shelf C1', is_active: 1
  },

  // ── EXPIRING IN 90 DAYS ─────────────────────────────────────────────────────
  {
    generic_name: 'Amlodipine', brand_name: 'Norvasc', drug_code: 'AML-10',
    drug_class: 'Calcium Channel Blocker', strength: '10mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Once daily',
    unit_cost: 120, stock_quantity: 180, reorder_level: 30,
    expiry_date: date(55), batch_number: 'BN2025-020',
    supplier_name: 'Pfizer Nigeria', supplier_phone: '+234-802-000-0011',
    storage_location: 'Shelf D1', is_active: 1
  },
  {
    generic_name: 'Lisinopril', brand_name: 'Zestril', drug_code: 'LIS-10',
    drug_class: 'ACE Inhibitor', strength: '10mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Once daily',
    unit_cost: 350, stock_quantity: 90, reorder_level: 20,
    expiry_date: date(70), batch_number: 'BN2025-021',
    supplier_name: 'AstraZeneca Nigeria', supplier_phone: '+234-802-000-0013',
    storage_location: 'Shelf D2', is_active: 1
  },
  {
    generic_name: 'Omeprazole', brand_name: 'Losec', drug_code: 'OMP-20',
    drug_class: 'Proton Pump Inhibitor', strength: '20mg', unit: 'capsule',
    default_dosage: '1 capsule', default_frequency: 'Once daily before food',
    unit_cost: 180, stock_quantity: 150, reorder_level: 30,
    expiry_date: date(80), batch_number: 'BN2025-022',
    supplier_name: 'Emzor Pharmaceuticals', supplier_phone: '+234-802-000-0002',
    storage_location: 'Shelf E1', is_active: 1
  },

  // ── GOOD STOCK (expiry > 90 days) ──────────────────────────────────────────
  {
    generic_name: 'Paracetamol', brand_name: 'Panadol', drug_code: 'PCM-500',
    drug_class: 'Analgesic/Antipyretic', strength: '500mg', unit: 'tablet',
    default_dosage: '2 tablets', default_frequency: 'Every 6 hours as needed',
    unit_cost: 30, stock_quantity: 500, reorder_level: 100,
    expiry_date: date(400), batch_number: 'BN2025-030',
    supplier_name: 'GSK Nigeria', supplier_phone: '+234-802-000-0003',
    storage_location: 'Shelf A4', is_active: 1
  },
  {
    generic_name: 'Metformin', brand_name: 'Glucophage', drug_code: 'MET-500',
    drug_class: 'Antidiabetic', strength: '500mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Twice daily with meals',
    unit_cost: 90, stock_quantity: 240, reorder_level: 50,
    expiry_date: date(365), batch_number: 'BN2025-031',
    supplier_name: 'Sanofi Nigeria', supplier_phone: '+234-802-000-0014',
    storage_location: 'Shelf D3', is_active: 1
  },
  {
    generic_name: 'Atorvastatin', brand_name: 'Lipitor', drug_code: 'ATV-20',
    drug_class: 'Statin', strength: '20mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Once daily at bedtime',
    unit_cost: 450, stock_quantity: 120, reorder_level: 25,
    expiry_date: date(500), batch_number: 'BN2025-032',
    supplier_name: 'Pfizer Nigeria', supplier_phone: '+234-802-000-0011',
    storage_location: 'Shelf D4', is_active: 1
  },
  {
    generic_name: 'Salbutamol', brand_name: 'Ventolin', drug_code: 'SAL-INH',
    drug_class: 'Bronchodilator', strength: '100mcg/dose', unit: 'inhaler',
    default_dosage: '2 puffs', default_frequency: 'As needed for shortness of breath',
    unit_cost: 2500, stock_quantity: 25, reorder_level: 5,
    expiry_date: date(300), batch_number: 'BN2025-033',
    supplier_name: 'GSK Nigeria', supplier_phone: '+234-802-000-0003',
    storage_location: 'Shelf F1', is_active: 1
  },
  {
    generic_name: 'Multivitamin', brand_name: 'Berocca', drug_code: 'MVI-TAB',
    drug_class: 'Vitamin/Supplement', strength: 'Standard', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Once daily',
    unit_cost: 250, stock_quantity: 300, reorder_level: 50,
    expiry_date: date(450), batch_number: 'BN2025-034',
    supplier_name: 'Bayer Nigeria', supplier_phone: '+234-802-000-0015',
    storage_location: 'Shelf G1', is_active: 1
  },
  {
    generic_name: 'Folic Acid', brand_name: 'Folate', drug_code: 'FOL-5',
    drug_class: 'Vitamin', strength: '5mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Once daily',
    unit_cost: 40, stock_quantity: 400, reorder_level: 80,
    expiry_date: date(600), batch_number: 'BN2025-035',
    supplier_name: 'Emzor Pharmaceuticals', supplier_phone: '+234-802-000-0002',
    storage_location: 'Shelf G2', is_active: 1
  },
  {
    generic_name: 'Tramadol', brand_name: 'Tramal', drug_code: 'TRM-50',
    drug_class: 'Opioid Analgesic', strength: '50mg', unit: 'capsule',
    default_dosage: '1 capsule', default_frequency: 'Every 6 hours as needed',
    unit_cost: 300, stock_quantity: 80, reorder_level: 15,
    expiry_date: date(350), batch_number: 'BN2025-036',
    supplier_name: 'Fidson Healthcare', supplier_phone: '+234-802-000-0001',
    storage_location: 'Shelf H1 (Controlled)', is_active: 1
  },
  // ── LOW STOCK (for inventory alerts demo) ──────────────────────────────────
  {
    generic_name: 'Insulin Glargine', brand_name: 'Lantus', drug_code: 'INS-GL',
    drug_class: 'Antidiabetic', strength: '100 IU/mL', unit: 'vial',
    default_dosage: '10-40 units', default_frequency: 'Once daily at bedtime',
    unit_cost: 12000, stock_quantity: 3, reorder_level: 5,
    expiry_date: date(180), batch_number: 'BN2025-040',
    supplier_name: 'Sanofi Nigeria', supplier_phone: '+234-802-000-0014',
    storage_location: 'Refrigerator R1', is_active: 1
  },
  {
    generic_name: 'Morphine Sulfate', brand_name: 'MS Contin', drug_code: 'MOR-10',
    drug_class: 'Opioid Analgesic', strength: '10mg', unit: 'tablet',
    default_dosage: '1 tablet', default_frequency: 'Every 8 hours',
    unit_cost: 800, stock_quantity: 8, reorder_level: 10,
    expiry_date: date(200), batch_number: 'BN2025-041',
    supplier_name: 'Mundipharma Nigeria', supplier_phone: '+234-802-000-0016',
    storage_location: 'Shelf H2 (Controlled)', is_active: 1
  },
];

console.log('🌱 Seeding medication_catalog...\n');

let inserted = 0;
let skipped = 0;

for (const med of medications) {
  try {
    // Check if already exists
    const existing = await query(
      'SELECT medication_id FROM medication_catalog WHERE drug_code = ?',
      [med.drug_code]
    );
    if (existing.rows?.length > 0) {
      console.log(`⏭️  Skip (exists): ${med.generic_name} (${med.drug_code})`);
      skipped++;
      continue;
    }

    await query(
      `INSERT INTO medication_catalog (
        generic_name, brand_name, drug_code, drug_class, strength, unit,
        default_dosage, default_frequency, unit_cost, is_active,
        stock_quantity, reorder_level, expiry_date, batch_number,
        supplier_name, supplier_phone, storage_location
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        med.generic_name, med.brand_name, med.drug_code, med.drug_class,
        med.strength, med.unit, med.default_dosage, med.default_frequency,
        med.unit_cost, med.is_active,
        med.stock_quantity, med.reorder_level, med.expiry_date,
        med.batch_number, med.supplier_name, med.supplier_phone,
        med.storage_location
      ]
    );
    console.log(`✅ Inserted: ${med.generic_name} (${med.drug_code}) — expires ${med.expiry_date}`);
    inserted++;
  } catch (err) {
    console.error(`❌ Failed: ${med.generic_name} — ${err.message}`);
  }
}

console.log(`\n🎉 Done! Inserted: ${inserted} | Skipped: ${skipped}`);
console.log('\n📊 Summary:');
console.log('  • 2 expired drugs (for expiry demo)');
console.log('  • 3 expiring within 30 days');
console.log('  • 3 expiring within 90 days');
console.log('  • 8 good stock / normal');
console.log('  • 2 low stock (below reorder level)');

const final = await query('SELECT COUNT(*) as total FROM medication_catalog');
console.log(`\n📦 Total medications in catalog: ${final.rows[0].total}`);
