// ============================================
// auditRoutes.js
// File: backend/src/routes/auditRoutes.js
// Mount: app.use('/api/v1/audit', auditRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;

// ── GET /audit — list with filters ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 50,
      user_id, action, resource_type,
      start_date, end_date,
      status_code, search,
    } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    const params = [];

    if (user_id)      { where.push('al.user_id = ?');          params.push(user_id);      }
    if (action)       { where.push('al.action = ?');            params.push(action);       }
    if (resource_type){ where.push('al.resource_type = ?');     params.push(resource_type);}
    if (status_code)  { where.push('al.status_code = ?');       params.push(status_code);  }
    if (start_date)   { where.push("date(al.created_at) >= ?"); params.push(start_date);   }
    if (end_date)     { where.push("date(al.created_at) <= ?"); params.push(end_date);     }
    if (search) {
      where.push('(al.full_name LIKE ? OR al.description LIKE ? OR al.resource_type LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM audit_logs al ${w}`, params);
    const logs  = await getAll(
      `SELECT al.*, u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ${w}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limit, 200), offset]
    );

    res.json({
      logs,
      pagination: {
        total: total?.n || 0,
        page:  +page,
        limit: +limit,
        totalPages: Math.ceil((total?.n || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /audit/stats — summary dashboard numbers ──────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [summary, byAction, byResource, byUser, byHour, recentErrors] = await Promise.all([
      getOne(`
        SELECT
          COUNT(*)                                                             AS total,
          SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END)    AS today,
          SUM(CASE WHEN action = 'CREATE' THEN 1 ELSE 0 END)                  AS creates,
          SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END)                  AS updates,
          SUM(CASE WHEN action = 'DELETE' THEN 1 ELSE 0 END)                  AS deletes,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)                 AS errors,
          COUNT(DISTINCT user_id)                                              AS unique_users
        FROM audit_logs
        WHERE created_at >= datetime('now', '-${days} days')
      `),
      getAll(`
        SELECT action, COUNT(*) AS count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY action ORDER BY count DESC LIMIT 10
      `),
      getAll(`
        SELECT resource_type, COUNT(*) AS count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-${days} days') AND resource_type IS NOT NULL
        GROUP BY resource_type ORDER BY count DESC LIMIT 10
      `),
      getAll(`
        SELECT user_id, full_name, user_role, COUNT(*) AS count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-${days} days') AND user_id IS NOT NULL
        GROUP BY user_id ORDER BY count DESC LIMIT 10
      `),
      getAll(`
        SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY hour ORDER BY hour ASC
      `),
      getAll(`
        SELECT * FROM audit_logs
        WHERE status_code >= 400
        ORDER BY created_at DESC LIMIT 10
      `),
    ]);

    res.json({ summary: summary || {}, byAction, byResource, byUser, byHour, recentErrors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /audit/:id — single log detail ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const log = await getOne(
      `SELECT al.*, u.username, u.email
       FROM audit_logs al LEFT JOIN users u ON al.user_id = u.user_id
       WHERE al.log_id = ?`,
      [req.params.id]
    );
    if (!log) return res.status(404).json({ error: 'Log entry not found' });

    // Parse JSON fields
    if (log.changes_before) {
      try { log.changes_before = JSON.parse(log.changes_before); } catch {}
    }
    if (log.changes_after) {
      try { log.changes_after = JSON.parse(log.changes_after); } catch {}
    }

    res.json({ log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /audit/export/csv — export filtered logs as CSV ───────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { start_date, end_date, user_id, action, resource_type } = req.query;
    let where = ['1=1'];
    const params = [];
    if (user_id)       { where.push('al.user_id = ?');         params.push(user_id);       }
    if (action)        { where.push('al.action = ?');           params.push(action);        }
    if (resource_type) { where.push('al.resource_type = ?');   params.push(resource_type); }
    if (start_date)    { where.push("date(al.created_at) >= ?");params.push(start_date);   }
    if (end_date)      { where.push("date(al.created_at) <= ?");params.push(end_date);     }

    const logs = await getAll(
      `SELECT al.log_id, al.created_at, al.full_name, al.user_role,
              al.action, al.resource_type, al.resource_id,
              al.http_method, al.endpoint, al.status_code,
              al.ip_address, al.description
       FROM audit_logs al
       WHERE ${where.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT 5000`,
      params
    );

    const cols = ['log_id','created_at','full_name','user_role','action',
                  'resource_type','resource_id','http_method','endpoint',
                  'status_code','ip_address','description'];
    const csv  = [
      cols.join(','),
      ...logs.map(row =>
        cols.map(c => `"${String(row[c] || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;