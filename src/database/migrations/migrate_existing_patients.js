// ============================================
// migrate_existing_patients.js
// File: backend/src/database/migrations/migrate_existing_patients.js
//
// Uses your existing query() function so it hits the correct database.
// Run: node src/database/migrations/migrate_existing_patients.js
// ============================================

import { query } from '../../config/database.js';
import bcrypt from 'bcryptjs';

const deriveCredentials = (patient) => {
  const { first_name, last_name, phone, email } = patient;
  const loginEmail      = email?.trim()
    ? email.trim().toLowerCase()
    : `${phone.replace(/\D/g, '')}@clinicore.patient`;
  const username        = `patient_${phone.replace(/\D/g, '')}`;
  const namePart        = last_name.replace(/\s/g, '').substring(0, 4).toUpperCase();
  const phonePart       = phone.replace(/\D/g, '').slice(-4);
  const defaultPassword = `${namePart}${phonePart}`;
  return { loginEmail, username, defaultPassword };
};

const migrate = async () => {
  console.log('🔄 Starting patient user account migration...\n');

  // Get all patients without a linked user account
  const patientsResult = await query(
    'SELECT * FROM patients WHERE user_id IS NULL AND is_active = 1'
  );
  const patients = patientsResult.rows || [];

  console.log(`📋 Found ${patients.length} patients without user accounts\n`);

  if (patients.length === 0) {
    console.log('✅ All patients already have user accounts. Nothing to do.');
    process.exit(0);
  }

  const results = { created: 0, linked: 0, errors: 0 };

  for (const patient of patients) {
    try {
      const { loginEmail, username, defaultPassword } = deriveCredentials(patient);

      // Check if a user already exists with this email or username
      const existingUser = await query(
        'SELECT user_id FROM users WHERE email = ? OR username = ?',
        [loginEmail, username]
      );

      let userId;

      if (existingUser.rows && existingUser.rows.length > 0) {
        userId = existingUser.rows[0].user_id;
        console.log(`  ⚠  ${patient.first_name} ${patient.last_name} — user already exists, linking`);
        results.linked++;
      } else {
        const hash = await bcrypt.hash(defaultPassword, 10);
        const userResult = await query(
          `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
           VALUES (?, ?, ?, ?, ?, 'patient', 1)`,
          [username, loginEmail, hash, `${patient.first_name} ${patient.last_name}`, patient.phone]
        );
        userId = userResult.lastID;

        console.log(`  ✅ ${patient.first_name} ${patient.last_name}`);
        console.log(`     Login email: ${loginEmail}`);
        console.log(`     Password:    ${defaultPassword}\n`);
        results.created++;
      }

      // Link the patient row to the user
      await query(
        'UPDATE patients SET user_id = ? WHERE patient_id = ?',
        [userId, patient.patient_id]
      );

    } catch (err) {
      console.error(`  ❌ Error for patient ${patient.patient_id}:`, err.message);
      results.errors++;
    }
  }

  console.log('\n📊 Migration complete:');
  console.log(`   ✅ Created: ${results.created} new user accounts`);
  console.log(`   🔗 Linked:  ${results.linked} existing accounts`);
  console.log(`   ❌ Errors:  ${results.errors}`);
  process.exit(0);
};

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});