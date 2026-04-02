import db from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔧 Initializing CliniCore Database...\n');

// Properly wait for database operations
function runSql(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function initializeDatabase() {
  try {
    // ============================================
    // LOAD SCHEMAS
    // ============================================
    console.log('📊 Loading Schemas:');
    console.log('─'.repeat(50));

    const schemasDir = path.join(__dirname, 'schemas');
    
    // Define schema loading order (important!)
    const schemaOrder = [
      'schema_phase0_core.sql',
      'schema_phase1_users_auth.sql',
      'schema_phase2_patients.sql',
      'schema_phase3_appointments.sql',
      'schema_phase4_consultations.sql',
      'schema_phase5_laboratory.sql',
      'schema_phase6_pharmacy.sql',
      'schema_phase7_billing.sql',
      'schema_phase10_admin.sql'
    ];

    for (const schemaFile of schemaOrder) {
      const schemaPath = path.join(schemasDir, schemaFile);
      
      if (!fs.existsSync(schemaPath)) {
        console.log(`⏭️  ${schemaFile} - not found, skipping`);
        continue;
      }

      try {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          await new Promise((resolve, reject) => {
            db.run(statement + ';', (err) => {
              if (err) {
                // Log error but continue
                console.warn(`  ⚠️  Error in ${schemaFile}: ${err.message}`);
              }
              resolve();
            });
          });
        }

        // Extract phase number for logging
        const match = schemaFile.match(/phase(\d+)/i);
        const phaseNum = match ? match[1] : '?';
        console.log(`✅ Phase ${phaseNum}: ${schemaFile.replace('.sql', '')}`);
      } catch (err) {
        console.warn(`❌ ${schemaFile}: ${err.message}`);
      }
    }

    // ============================================
    // LOAD MIGRATIONS
    // ============================================
    console.log('\n🔄 Running Migrations:');
    console.log('─'.repeat(50));

    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const migrations = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const mig of migrations) {
        try {
          const sql = fs.readFileSync(path.join(migrationsDir, mig), 'utf8');
          
          const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

          for (const statement of statements) {
            await new Promise((resolve, reject) => {
              db.run(statement + ';', (err) => {
                if (err) {
                  console.warn(`  ⚠️  ${mig}: ${err.message}`);
                }
                resolve();
              });
            });
          }

          console.log(`✅ ${mig}`);
        } catch (err) {
          console.warn(`⚠️  ${mig}: ${err.message}`);
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
    
    // Define seed loading order (important!)
    const seedOrder = [
      'seed_patients.sql',
      'seed_permissions.sql',
      'seed_roles.sql',
      'seed_users.sql'
    ];

    if (fs.existsSync(seedsDir)) {
      for (const seedFile of seedOrder) {
        const seedPath = path.join(seedsDir, seedFile);
        
        if (!fs.existsSync(seedPath)) {
          console.log(`⏭️  ${seedFile} - not found, skipping`);
          continue;
        }

        try {
          const sql = fs.readFileSync(seedPath, 'utf8');
          
          const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

          for (const statement of statements) {
            await new Promise((resolve, reject) => {
              db.run(statement + ';', (err) => {
                if (err) {
                  console.warn(`  ⚠️  ${seedFile}: ${err.message}`);
                }
                resolve();
              });
            });
          }

          console.log(`✅ ${seedFile}`);
        } catch (err) {
          console.warn(`⚠️  ${seedFile}: ${err.message}`);
        }
      }
    } else {
      console.log('ℹ️  No seeds folder found');
    }

    // Small delay to ensure all writes complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n✅ Database initialization complete!');
    console.log('🎉 CliniCore is ready to use!\n');

    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    return false;
  }
}

// Export only - DO NOT auto-run
// server.js will call this function
export { initializeDatabase };