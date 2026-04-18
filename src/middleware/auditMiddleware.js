// ============================================
// auditMiddleware.js
// File: backend/src/middleware/auditMiddleware.js
//
// Drop-in Express middleware that captures a full
// audit trail entry for every mutating request.
//
// Usage in routes:
//   import { auditLog } from '../middleware/auditMiddleware.js';
//   router.post('/patients', auditLog('CREATE', 'Patient'), createPatient);
//   router.put('/patients/:id', auditLog('UPDATE', 'Patient'), updatePatient);
//   router.delete('/patients/:id', auditLog('DELETE', 'Patient'), deletePatient);
//
// Auto-wired globally for all routes via server.js (optional):
//   import { globalAuditMiddleware } from '../middleware/auditMiddleware.js';
//   app.use(globalAuditMiddleware);
// ============================================
import { query } from '../config/database.js';

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;

// ── Core logger ───────────────────────────────────────────────────────────────
const writeAuditLog = async ({
  userId, action, resourceType, resourceId,
  httpMethod, endpoint, statusCode,
  ipAddress, userAgent, description,
  changesBefore, changesAfter,
}) => {
  try {
    // Get user details (role, name) — cached on req in prod
    let userRole = null, fullName = null;
    if (userId) {
      const u = await getOne('SELECT role, full_name FROM users WHERE user_id = ?', [userId]);
      userRole = u?.role;
      fullName = u?.full_name;
    }

    await query(
      `INSERT INTO audit_logs
        (user_id, user_role, full_name, action, resource_type, resource_id,
         http_method, endpoint, status_code, ip_address, user_agent,
         changes_before, changes_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        userId || null,
        userRole || null,
        fullName || null,
        action,
        resourceType || null,
        resourceId ? String(resourceId) : null,
        httpMethod || null,
        endpoint || null,
        statusCode || null,
        ipAddress || null,
        userAgent ? userAgent.slice(0, 200) : null,
        changesBefore ? JSON.stringify(changesBefore) : null,
        changesAfter  ? JSON.stringify(changesAfter)  : null,
        description || null,
      ]
    );
  } catch (err) {
    // Never block a request because of logging failure
    console.warn('Audit log write failed (non-critical):', err.message);
  }
};

// ── Named middleware for specific routes ──────────────────────────────────────
export const auditLog = (action, resourceType, descriptionFn = null) => {
  return (req, res, next) => {
    const startTime = Date.now();

    // Capture response after it finishes
    res.on('finish', () => {
      const resourceId  = req.params?.id || res.locals?.resourceId || null;
      const ipAddress   = req.ip || req.connection?.remoteAddress || null;
      const userAgent   = req.headers?.['user-agent'] || null;
      const description = descriptionFn
        ? descriptionFn(req, res)
        : `${action} ${resourceType}${resourceId ? ` #${resourceId}` : ''}`;

      writeAuditLog({
        userId:       req.user?.user_id,
        action,
        resourceType,
        resourceId,
        httpMethod:   req.method,
        endpoint:     req.originalUrl,
        statusCode:   res.statusCode,
        ipAddress,
        userAgent,
        description,
        changesBefore: req.auditBefore || null,
        changesAfter:  req.auditAfter  || null,
      }).catch(() => {});
    });

    next();
  };
};

// ── Global auto-audit middleware (mounts on all routes) ───────────────────────
// Logs every mutating request automatically without touching route files.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const RESOURCE_MAP = {
  '/patients':        'Patient',
  '/appointments':    'Appointment',
  '/consultations':   'Consultation',
  '/lab':             'Lab',
  '/pharmacy':        'Pharmacy',
  '/billing':         'Billing',
  '/users':           'User',
  '/beds':            'Bed',
  '/supply-chain':    'SupplyChain',
  '/scheduling':      'Schedule',
  '/imaging':         'Imaging',
  '/maternity':       'Maternity',
  '/insurance':       'Insurance',
};

const ACTION_MAP = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

const deriveResource = (url) => {
  const path = url.replace('/api/v1', '').split('?')[0];
  for (const [prefix, name] of Object.entries(RESOURCE_MAP)) {
    if (path.startsWith(prefix)) return name;
  }
  return path.split('/')[1] || 'Unknown';
};

const deriveAction = (method, url) => {
  const path = url.replace('/api/v1', '').split('?')[0];
  if (method === 'POST' && path.includes('/check-in'))   return 'CHECK_IN';
  if (method === 'POST' && path.includes('/check-out'))  return 'CHECK_OUT';
  if (method === 'POST' && path.includes('/upload'))     return 'UPLOAD';
  if (method === 'POST' && path.includes('/payments'))   return 'PAYMENT';
  if (method === 'POST' && path.includes('/admit'))      return 'ADMIT';
  if (method === 'PUT'  && path.includes('/discharge'))  return 'DISCHARGE';
  if (method === 'PUT'  && path.includes('/status'))     return 'STATUS_CHANGE';
  if (method === 'PUT'  && path.includes('/review'))     return 'REVIEW';
  if (method === 'POST' && path.includes('/assess'))     return 'ASSESS';
  return ACTION_MAP[method] || method;
};

export const globalAuditMiddleware = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (!req.originalUrl.includes('/api/v1')) return next();
  // Skip auth endpoints
  if (req.originalUrl.includes('/auth/')) return next();
  // Skip read-only operations with GET
  if (req.method === 'GET') return next();

  res.on('finish', () => {
    // Only log successful operations (2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const resourceId = req.params?.id || null;
    const resource   = deriveResource(req.originalUrl);
    const action     = deriveAction(req.method, req.originalUrl);

    writeAuditLog({
      userId:       req.user?.user_id,
      action,
      resourceType: resource,
      resourceId,
      httpMethod:   req.method,
      endpoint:     req.originalUrl.split('?')[0],
      statusCode:   res.statusCode,
      ipAddress:    req.ip || req.connection?.remoteAddress,
      userAgent:    req.headers?.['user-agent'],
      description:  `${action} ${resource}${resourceId ? ` #${resourceId}` : ''}`,
    }).catch(() => {});
  });

  next();
};

// ── Helper: attach before-snapshot to request (call before update) ────────────
// Usage: req.auditBefore = await getAuditSnapshot('patients', id);
export const getAuditSnapshot = async (table, id, idCol = null) => {
  const col = idCol || `${table.replace(/s$/, '')}_id`;
  try {
    const row = await getOne(`SELECT * FROM ${table} WHERE ${col} = ?`, [id]);
    return row || null;
  } catch {
    return null;
  }
};