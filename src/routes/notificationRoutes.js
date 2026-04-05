// ============================================
// notificationRoutes.js
// File: backend/src/routes/notificationRoutes.js
// Mount: app.use('/api/v1/notifications', notificationRoutes)
// ============================================

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendSMS, sendEmail, logNotification } from '../services/notificationService.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);

// GET /notifications/log  — audit log (admin only)
router.get('/log', authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, type, channel } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (type)    { where += ' AND type = ?';    params.push(type);    }
    if (channel) { where += ' AND channel = ?'; params.push(channel); }

    const total = await query(`SELECT COUNT(*) as n FROM notifications_log ${where}`, params);
    const logs  = await query(
      `SELECT nl.*, p.first_name, p.last_name
       FROM notifications_log nl
       LEFT JOIN patients p ON nl.patient_id = p.patient_id
       ${where}
       ORDER BY nl.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      logs:       logs.rows || [],
      pagination: { total: total.rows[0]?.n || 0, page: +page, limit: +limit },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/send/sms  — manual SMS (admin/receptionist)
router.post('/send/sms', authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const { to, message, patient_id } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });

    const result = await sendSMS(to, message);
    await logNotification(req.db, {
      patient_id: patient_id || null,
      user_id:    req.user.user_id,
      type:       'manual',
      channel:    'sms',
      recipient:  to,
      body:       message,
      status:     result.success ? 'sent' : 'failed',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/send/email  — manual email (admin)
router.post('/send/email', authorize('admin'), async (req, res) => {
  try {
    const { to, subject, body, patient_id } = req.body;
    if (!to || !subject || !body)
      return res.status(400).json({ error: 'to, subject and body are required' });

    const result = await sendEmail({ to, subject, html: body });
    await logNotification(req.db, {
      patient_id: patient_id || null,
      user_id:    req.user.user_id,
      type:       'manual',
      channel:    'email',
      recipient:  to,
      subject,
      body,
      status:     result.success ? 'sent' : 'failed',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications/stats  — delivery stats (admin)
router.get('/stats', authorize('admin'), async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        channel,
        type,
        status,
        COUNT(*) as count
      FROM notifications_log
      WHERE created_at >= date('now', '-30 days')
      GROUP BY channel, type, status
    `);

    const total = await query(`
      SELECT
        SUM(CASE WHEN status = 'sent'   THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COUNT(*) as total
      FROM notifications_log
      WHERE created_at >= date('now', '-30 days')
    `);

    res.json({ breakdown: stats.rows || [], summary: total.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;