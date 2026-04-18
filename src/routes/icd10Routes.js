// ============================================
// icd10Routes.js
// File: backend/src/routes/icd10Routes.js
// Mount: app.use('/api/v1/icd10', icd10Routes)
// ============================================
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);

const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;

// ── GET /icd10/search?q=malaria&category=Infectious&limit=20 ─────────────────
router.get('/search', async (req, res) => {
  try {
    const { q = '', category, limit = 20 } = req.query;
    const term = q.trim();

    let where = ['is_active = 1'];
    const params = [];

    if (term) {
      // Match code prefix OR description keyword
      where.push('(code LIKE ? OR description LIKE ?)');
      params.push(`${term.toUpperCase()}%`, `%${term}%`);
    }
    if (category) { where.push('category = ?'); params.push(category); }

    const rows = await getAll(
      `SELECT code, description, category
       FROM icd10_codes
       WHERE ${where.join(' AND ')}
       ORDER BY
         CASE WHEN code LIKE ? THEN 0 ELSE 1 END,
         CASE WHEN description LIKE ? THEN 0 ELSE 1 END,
         code ASC
       LIMIT ?`,
      [...params, `${term.toUpperCase()}%`, `${term}%`, Math.min(+limit, 50)]
    );
    res.json({ codes: rows, query: term, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /icd10/categories — distinct categories ───────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT DISTINCT category, COUNT(*) as count FROM icd10_codes WHERE is_active=1 GROUP BY category ORDER BY category'
    );
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /icd10/:code — single code detail ────────────────────────────────────
router.get('/:code', async (req, res) => {
  try {
    const row = await getOne(
      'SELECT * FROM icd10_codes WHERE code = ? AND is_active = 1',
      [req.params.code.toUpperCase()]
    );
    if (!row) return res.status(404).json({ error: `ICD-10 code ${req.params.code} not found` });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /icd10 — list by category ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    let where = ['is_active = 1'];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    const rows = await getAll(
      `SELECT code, description, category FROM icd10_codes
       WHERE ${where.join(' AND ')}
       ORDER BY category, code LIMIT ?`,
      [...params, Math.min(+limit, 200)]
    );
    res.json({ codes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;