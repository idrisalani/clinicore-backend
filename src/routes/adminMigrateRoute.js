// ============================================
// Add this temporarily to server.js
// REMOVE after migration is confirmed complete
//
// Call it once via browser or curl:
//   GET https://clinicore-backend-71qa.onrender.com/admin-migrate?secret=YOUR_SECRET
// ============================================

import { query } from './src/config/database.js';
import { encrypt, hashForSearch, isEncrypted } from './src/utils/encryption.js';

export const registerMigrateRoute = (app) => {

  app.get('/admin-migrate', async (req, res) => {
    // Secret guard — change this to something only you know
    const secret = req.query.secret;
    if (secret !== process.env.MIGRATE_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const log = [];
    const step = (msg) => { log.push(msg); console.log(msg); };

    try {
      // ── Step 1: Add hash columns ──────────────────────────────────────────
      const schemaSqls = [
        'ALTER TABLE patients ADD COLUMN phone_hash TEXT',
        'ALTER TABLE patients ADD COLUMN email_hash TEXT',
        'ALTER TABLE patients ADD COLUMN nin_hash TEXT',
        'ALTER TABLE users ADD COLUMN phone_hash TEXT',
        'CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash)',
        'CREATE INDEX IF NOT EXISTS idx_patients_email_hash ON patients(email_hash)',
      ];
      for (const sql of schemaSqls) {
        await query(sql).catch(e => {
          if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists'))
            step(`  ⚠️ Schema: ${e.message.split('\n')[0]}`);
        });
      }
      step('✅ Schema columns ready');

      // ── Step 2: Encrypt existing patient PHI ──────────────────────────────
      const patients = (await query('SELECT * FROM patients')).rows || [];
      let encrypted = 0, skipped = 0;

      for (const p of patients) {
        if (isEncrypted(p.phone)) { skipped++; continue; }

        await query(
          `UPDATE patients SET
            phone                   = ?,
            phone_hash              = ?,
            email                   = ?,
            email_hash              = ?,
            address                 = ?,
            insurance_policy_number = ?,
            insurance_group_number  = ?,
            emergency_contact_phone = ?
           WHERE patient_id = ?`,
          [
            p.phone                   ? encrypt(p.phone)                   : null,
            p.phone                   ? hashForSearch(p.phone)             : null,
            p.email                   ? encrypt(p.email)                   : null,
            p.email                   ? hashForSearch(p.email)             : null,
            p.address                 ? encrypt(p.address)                 : null,
            p.insurance_policy_number ? encrypt(p.insurance_policy_number) : null,
            p.insurance_group_number  ? encrypt(p.insurance_group_number)  : null,
            p.emergency_contact_phone ? encrypt(p.emergency_contact_phone) : null,
            p.patient_id,
          ]
        );
        encrypted++;
      }
      step(`✅ Patients: ${encrypted} encrypted, ${skipped} already done`);

      // ── Step 3: Verify ────────────────────────────────────────────────────
      const total = (await query('SELECT COUNT(*) as n FROM patients')).rows[0]?.n || 0;
      const done  = (await query("SELECT COUNT(*) as n FROM patients WHERE phone LIKE 'enc:v1:%'")).rows[0]?.n || 0;
      step(`✅ Coverage: ${done}/${total} patients (${Math.round((done/Math.max(total,1))*100)}%)`);

      return res.json({
        success: true,
        log,
        summary: { total, encrypted: done, skipped },
      });

    } catch (err) {
      step(`❌ Error: ${err.message}`);
      return res.status(500).json({ success: false, log, error: err.message });
    }
  });

  console.log('⚠️  Admin migrate route registered — REMOVE after use');
};