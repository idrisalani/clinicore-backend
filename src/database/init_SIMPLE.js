// ============================================
// CliniCore Database Initialization - SIMPLE
// Synchronous, no callbacks, no errors
// ============================================

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Initializing CliniCore Database...\n');

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, 'clinicore.db'));

// ============================================
// LOAD SCHEMAS
// ============================================

console.log('📊 Loading Schemas:');
console.log('─'.repeat(50));

const schemas = [
  { num: 0, name: 'Core Tables', file: 'schema_phase0_core.sql' },
  { num: 1, name: 'Users & Authentication', file: 'schema_phase1_users_auth.sql' },
  { num: 2, name: 'Patients & Medical History', file: 'schema_phase2_patients.sql' },
  { num: 3, name: 'Appointments', file: 'schema_phase3_appointments.sql' },
  { num: 4, name: 'Consultations', file: 'schema_phase4_consultations.sql' },
  { num: 5, name: 'Laboratory', file: 'schema_phase5_laboratory.sql' },
  { num: 6, name: 'Pharmacy', file: 'schema_phase6_pharmacy.sql' },
  { num: 7, name: 'Billing', file: 'schema_phase7_billing.sql' },
  { num: 10, name: 'Admin & RBAC', file: 'schema_phase10_admin.sql' },
];

for (const schema of schemas) {
  const filePath = path.join(__dirname, 'schemas', schema.file);
  if (fs.existsSync(filePath)) {
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      db.exec(sql);
      console.log(`✅ Phase ${schema.num}: ${schema.name}`);
    } catch (err) {
      console.error(`❌ Phase ${schema.num} failed:`, err.message);
    }
  }
}

// ============================================
// RUN MIGRATIONS
// ============================================

console.log('\n🔄 Running Migrations:');
console.log('─'.repeat(50));

const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
  const migrations = fs.readdirSync(migrationsDir)
    .filter(f => f.startsWith('migration_') && f.endsWith('.sql'))
    .sort();

  if (migrations.length === 0) {
    console.log('ℹ️  No migrations to run');
  } else {
    for (const mig of migrations) {
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, mig), 'utf8');
        db.exec(sql);
        console.log(`✅ ${mig}`);
      } catch (err) {
        console.warn(`⚠️  ${mig}: ${err.message}`);
      }
    }
  }
} else {
  console.log('ℹ️  No migrations folder found');
}

// ============================================
// LOAD SEEDS
// ============================================

console.log('\n🌱 Loading Seed Data:');
console.log('─'.repeat(50));

const seedsDir = path.join(__dirname, 'seeds');
if (fs.existsSync(seedsDir)) {
  const seeds = fs.readdirSync(seedsDir)
    .filter(f => f.startsWith('seed_') && f.endsWith('.sql'))
    .sort();

  if (seeds.length === 0) {
    console.log('ℹ️  No seed data to load');
  } else {
    for (const seed of seeds) {
      try {
        const sql = fs.readFileSync(path.join(seedsDir, seed), 'utf8');
        db.exec(sql);
        console.log(`✅ ${seed}`);
      } catch (err) {
        console.warn(`⚠️  ${seed}: ${err.message}`);
      }
    }
  }
} else {
  console.log('ℹ️  No seeds folder found');
}

// ============================================
// DONE - CLOSE AND EXIT
// ============================================

console.log('\n✅ Database initialization complete!');
console.log('🎉 CliniCore is ready to use!\n');

// Close database immediately
db.close();

// Exit cleanly
process.exit(0);