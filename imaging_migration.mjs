// ============================================
// imaging_migration.mjs
// Run: node imaging_migration.mjs  (from backend/)
// ============================================
import { query } from './src/config/database.js';

console.log('🩻 Running Medical Imaging migration...\n');

await query(`
  CREATE TABLE IF NOT EXISTS medical_images (
    image_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id         INTEGER NOT NULL REFERENCES patients(patient_id),
    consultation_id    INTEGER REFERENCES consultations(consultation_id),
    lab_order_id       INTEGER REFERENCES lab_orders(lab_order_id),

    -- Image identity
    image_type         TEXT NOT NULL
      CHECK(image_type IN (
        'X-Ray','CT Scan','MRI','Ultrasound','ECG',
        'Endoscopy','Mammogram','PET Scan','Other'
      )),
    body_part          TEXT,
    laterality         TEXT CHECK(laterality IN ('Left','Right','Bilateral','N/A')),
    study_date         DATE,

    -- Cloudinary fields
    cloudinary_public_id TEXT NOT NULL,
    cloudinary_url       TEXT NOT NULL,
    cloudinary_secure_url TEXT NOT NULL,
    cloudinary_format    TEXT,
    file_size_bytes      INTEGER,
    width                INTEGER,
    height               INTEGER,
    resource_type        TEXT DEFAULT 'image',

    -- Clinical
    study_description  TEXT,
    clinical_notes     TEXT,
    radiologist_report TEXT,
    ai_analysis        TEXT,
    findings_flagged   INTEGER DEFAULT 0,

    -- Status
    status             TEXT DEFAULT 'Active'
      CHECK(status IN ('Active','Archived','Deleted')),

    -- Admin
    uploaded_by        INTEGER REFERENCES users(user_id),
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ medical_images table'))
  .catch(e => console.log('  ⏭ ', e.message.split('\n')[0]));

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_img_patient        ON medical_images(patient_id)',
  'CREATE INDEX IF NOT EXISTS idx_img_consultation   ON medical_images(consultation_id)',
  'CREATE INDEX IF NOT EXISTS idx_img_type           ON medical_images(image_type)',
  'CREATE INDEX IF NOT EXISTS idx_img_study_date     ON medical_images(study_date)',
  'CREATE INDEX IF NOT EXISTS idx_img_flagged        ON medical_images(findings_flagged)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

const r = await query('SELECT COUNT(*) as c FROM medical_images');
console.log(`\n🎉 Done! medical_images rows: ${r.rows[0]?.c}`);