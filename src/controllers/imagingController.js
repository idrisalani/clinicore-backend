// ============================================
// imagingController.js
// File: backend/src/controllers/imagingController.js
//
// Storage: Cloudinary (free tier: 25GB storage + CDN)
// Install: npm install cloudinary multer multer-storage-cloudinary
//
// .env needed:
//   CLOUDINARY_CLOUD_NAME=your_cloud_name
//   CLOUDINARY_API_KEY=your_api_key
//   CLOUDINARY_API_SECRET=your_api_secret
//   ANTHROPIC_API_KEY=sk-ant-...  (optional — for AI analysis)
// ============================================
import { query } from '../config/database.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── POST /imaging/upload ──────────────────────────────────────────────────────
// multer-storage-cloudinary handles the upload before this runs
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const {
      patient_id, consultation_id, lab_order_id,
      image_type, body_part, laterality, study_date,
      study_description, clinical_notes,
    } = req.body;

    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
    if (!image_type) return res.status(400).json({ error: 'image_type is required' });

    // Cloudinary fields come from req.file (set by multer-storage-cloudinary)
    const {
      filename: public_id,
      path:     secure_url,
      format,
      size,
      width,
      height,
    } = req.file;

    // Build plain HTTP url from secure_url (for thumbnail generation)
    const http_url = secure_url.replace('https://', 'http://');

    const result = await query(
      `INSERT INTO medical_images (
        patient_id, consultation_id, lab_order_id,
        image_type, body_part, laterality, study_date,
        cloudinary_public_id, cloudinary_url, cloudinary_secure_url,
        cloudinary_format, file_size_bytes, width, height,
        study_description, clinical_notes, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        consultation_id || null,
        lab_order_id    || null,
        image_type,
        body_part       || null,
        laterality      || null,
        study_date      || null,
        public_id,
        http_url,
        secure_url,
        format          || null,
        size            || null,
        width           || null,
        height          || null,
        study_description || null,
        clinical_notes    || null,
        req.user.user_id,
      ]
    );

    const image = await getOne(
      'SELECT * FROM medical_images WHERE image_id = ?', [result.lastID]
    );

    console.log(`✅ Image uploaded: ${public_id}`);
    res.status(201).json({
      message:  'Image uploaded successfully',
      image_id: result.lastID,
      image,
    });
  } catch (err) {
    console.error('uploadImage error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /imaging — list with filters ─────────────────────────────────────────
export const getAllImages = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, patient_id, image_type,
      consultation_id, flagged,
    } = req.query;
    const offset = (page - 1) * limit;

    let where = ['mi.status = ?'];
    const params = ['Active'];
    if (patient_id)      { where.push('mi.patient_id = ?');      params.push(patient_id);      }
    if (image_type)      { where.push('mi.image_type = ?');      params.push(image_type);      }
    if (consultation_id) { where.push('mi.consultation_id = ?'); params.push(consultation_id); }
    if (flagged)         { where.push('mi.findings_flagged = 1');                              }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM medical_images mi ${w}`, params);
    const rows  = await getAll(
      `SELECT mi.*,
              p.first_name, p.last_name, p.phone,
              u.full_name AS uploaded_by_name
       FROM medical_images mi
       JOIN patients p ON mi.patient_id = p.patient_id
       LEFT JOIN users u ON mi.uploaded_by = u.user_id
       ${w}
       ORDER BY mi.study_date DESC, mi.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      images: rows,
      pagination: {
        total: total?.n || 0, page: +page, limit: +limit,
        totalPages: Math.ceil((total?.n || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /imaging/:id ──────────────────────────────────────────────────────────
export const getImageById = async (req, res) => {
  try {
    const image = await getOne(
      `SELECT mi.*,
              p.first_name, p.last_name, p.phone,
              u.full_name AS uploaded_by_name,
              c.chief_complaint
       FROM medical_images mi
       JOIN patients p ON mi.patient_id = p.patient_id
       LEFT JOIN users u ON mi.uploaded_by = u.user_id
       LEFT JOIN consultations c ON mi.consultation_id = c.consultation_id
       WHERE mi.image_id = ? AND mi.status = 'Active'`,
      [req.params.id]
    );
    if (!image) return res.status(404).json({ error: 'Image not found' });
    res.json({ image });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /imaging/patient/:patientId ───────────────────────────────────────────
export const getPatientImages = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { image_type, limit = 50 } = req.query;
    let where = ["mi.patient_id = ? AND mi.status = 'Active'"];
    const params = [patientId];
    if (image_type) { where.push('mi.image_type = ?'); params.push(image_type); }

    const rows = await getAll(
      `SELECT mi.*, u.full_name AS uploaded_by_name
       FROM medical_images mi
       LEFT JOIN users u ON mi.uploaded_by = u.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY mi.study_date DESC, mi.created_at DESC LIMIT ?`,
      [...params, limit]
    );
    res.json({ images: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /imaging/:id — update notes / report ──────────────────────────────────
export const updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { clinical_notes, radiologist_report, study_description, findings_flagged } = req.body;

    const existing = await getOne(
      "SELECT image_id FROM medical_images WHERE image_id = ? AND status = 'Active'", [id]
    );
    if (!existing) return res.status(404).json({ error: 'Image not found' });

    await query(
      `UPDATE medical_images SET
        clinical_notes     = COALESCE(?, clinical_notes),
        radiologist_report = COALESCE(?, radiologist_report),
        study_description  = COALESCE(?, study_description),
        findings_flagged   = COALESCE(?, findings_flagged),
        updated_at         = CURRENT_TIMESTAMP
       WHERE image_id = ?`,
      [
        clinical_notes     || null,
        radiologist_report || null,
        study_description  || null,
        findings_flagged   !== undefined ? (findings_flagged ? 1 : 0) : null,
        id,
      ]
    );
    const updated = await getOne('SELECT * FROM medical_images WHERE image_id = ?', [id]);
    res.json({ message: 'Image updated', image: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /imaging/:id — soft delete + Cloudinary cleanup ───────────────────
export const deleteImage = async (req, res) => {
  try {
    const image = await getOne(
      "SELECT * FROM medical_images WHERE image_id = ? AND status = 'Active'", [req.params.id]
    );
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Soft-delete in DB
    await query(
      "UPDATE medical_images SET status = 'Deleted', updated_at = CURRENT_TIMESTAMP WHERE image_id = ?",
      [req.params.id]
    );

    // Delete from Cloudinary (non-critical)
    cloudinary.uploader.destroy(image.cloudinary_public_id, { resource_type: image.resource_type || 'image' })
      .then(r => console.log(`Cloudinary delete: ${r.result}`))
      .catch(e => console.warn('Cloudinary delete failed (non-critical):', e.message));

    res.json({ message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /imaging/:id/analyze — AI analysis via Claude vision ─────────────────
export const analyzeImage = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI analysis not configured' });
    }

    const image = await getOne(
      "SELECT * FROM medical_images WHERE image_id = ? AND status = 'Active'", [req.params.id]
    );
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const prompt = `You are a medical imaging assistant helping a doctor in Lagos, Nigeria. 
Analyse this ${image.image_type} image of the ${image.body_part || 'unspecified body part'}.

Study description: ${image.study_description || 'None provided'}
Clinical notes: ${image.clinical_notes || 'None provided'}

Provide:
1. A brief description of what is visible in the image
2. Any notable findings or areas that may warrant attention
3. Suggested follow-up or comparison studies if relevant

IMPORTANT: This is a preliminary AI-assisted observation to support the doctor — NOT a diagnosis. 
Always state clearly that a qualified radiologist or specialist must review this.
Keep response concise (under 200 words).`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'url', url: image.cloudinary_secure_url },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'AI analysis failed' });
    }

    const data      = await response.json();
    const analysis  = data.content?.[0]?.text || '';

    // Save analysis to DB
    await query(
      'UPDATE medical_images SET ai_analysis = ?, updated_at = CURRENT_TIMESTAMP WHERE image_id = ?',
      [analysis, req.params.id]
    );

    res.json({ analysis, image_id: req.params.id });
  } catch (err) {
    console.error('analyzeImage error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /imaging/stats ────────────────────────────────────────────────────────
export const getImagingStats = async (req, res) => {
  try {
    const stats = await getOne(`
      SELECT
        COUNT(*)                                                          AS total,
        SUM(CASE WHEN findings_flagged = 1    THEN 1 ELSE 0 END)        AS flagged,
        SUM(CASE WHEN ai_analysis IS NOT NULL THEN 1 ELSE 0 END)        AS ai_analysed,
        SUM(CASE WHEN image_type = 'X-Ray'    THEN 1 ELSE 0 END)        AS xrays,
        SUM(CASE WHEN image_type = 'Ultrasound'THEN 1 ELSE 0 END)       AS ultrasounds,
        SUM(CASE WHEN image_type = 'CT Scan'  THEN 1 ELSE 0 END)        AS ct_scans,
        SUM(CASE WHEN image_type = 'MRI'      THEN 1 ELSE 0 END)        AS mris,
        ROUND(SUM(file_size_bytes) / 1048576.0, 1)                       AS total_mb
      FROM medical_images WHERE status = 'Active'
    `);
    res.json(stats || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};