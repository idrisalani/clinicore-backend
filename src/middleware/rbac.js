// ============================================
// RBAC Middleware - Permission & Role Checking
// File: backend/src/middleware/rbac.js
// ============================================

import { query } from '../config/database.js';

// ── Helper: get a single row ──────────────────────────────────────────────────
const getOne = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows?.[0] || null;
};

// ── Helper: get multiple rows ─────────────────────────────────────────────────
const getAll = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows || [];
};

// ============================================
// CHECK PERMISSION MIDDLEWARE
// ============================================

export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Get user's role
      const userRow = await getOne(
        'SELECT role FROM users WHERE user_id = ?',
        [userId]
      );
      if (!userRow) return res.status(401).json({ error: 'User not found' });

      // Admins with no permissions yet get full pass-through
      if (userRow.role?.toLowerCase() === 'admin') {
        // Look up role_id to check if any permissions are assigned
        const roleRow = await getOne(
          'SELECT role_id FROM roles WHERE LOWER(role_name) = LOWER(?)',
          [userRow.role]
        );

        if (roleRow) {
          const permRows = await getAll(`
            SELECT p.name FROM permissions p
            JOIN role_permissions rp ON p.permission_id = rp.permission_id
            WHERE rp.role_id = ?
          `, [roleRow.role_id]);

          // If permissions are assigned, enforce them
          if (permRows.length > 0) {
            const perms = permRows.map(p => p.name);
            if (!perms.includes(requiredPermission)) {
              return res.status(403).json({
                error: 'Insufficient permissions',
                required: requiredPermission,
                have: perms,
              });
            }
          }
          // If no permissions assigned to admin role yet → allow through
        }
        return next();
      }

      // Non-admin: look up role_id then check permissions
      const roleRow = await getOne(
        'SELECT role_id FROM roles WHERE LOWER(role_name) = LOWER(?)',
        [userRow.role]
      );

      if (!roleRow) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermission,
        });
      }

      const permRows = await getAll(`
        SELECT p.name FROM permissions p
        JOIN role_permissions rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id = ?
      `, [roleRow.role_id]);

      const perms = permRows.map(p => p.name);
      if (!perms.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermission,
          have: perms,
        });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ error: err.message });
    }
  };
};

// ============================================
// CHECK ROLE MIDDLEWARE
// ============================================

export const checkRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userRow = await getOne(
        'SELECT role FROM users WHERE user_id = ?',
        [userId]
      );
      if (!userRow) return res.status(401).json({ error: 'User not found' });

      const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      const userRoleLower = (userRow.role || '').toLowerCase();
      const allowed = rolesArray.some(r => r.toLowerCase() === userRoleLower);

      if (!allowed) {
        return res.status(403).json({
          error: 'Insufficient role',
          required: rolesArray,
          have: userRow.role,
        });
      }

      next();
    } catch (err) {
      console.error('Role check error:', err);
      res.status(500).json({ error: err.message });
    }
  };
};

// ============================================
// ACTIVITY LOGGING MIDDLEWARE
// ============================================

export const logActivity = (action, resource) => {
  return async (req, res, next) => {
    try {
      const userId     = req.user?.user_id;
      const ipAddress  = req.ip || req.connection?.remoteAddress || '';
      const resourceId = req.params?.id || null;

      res.on('finish', async () => {
        try {
          await query(`
            INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address)
            VALUES (?, ?, ?, ?, ?)
          `, [userId, action, resource, resourceId, ipAddress]);
        } catch (err) {
          console.error('Activity logging error:', err.message);
        }
      });

      next();
    } catch (err) {
      console.error('Logging setup error:', err.message);
      next();
    }
  };
};

// ============================================
// IS ADMIN MIDDLEWARE
// ============================================

export const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userRow = await getOne(
      'SELECT role FROM users WHERE user_id = ?',
      [userId]
    );

    if (!userRow || userRow.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error('isAdmin error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// IS SUPER ADMIN MIDDLEWARE
// ============================================

export const isSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userRow = await getOne(
      'SELECT role FROM users WHERE user_id = ?',
      [userId]
    );
    if (!userRow) return res.status(403).json({ error: 'Super admin access required' });

    const roleRow = await getOne(
      'SELECT level FROM roles WHERE LOWER(role_name) = LOWER(?)',
      [userRow.role]
    );

    if (!roleRow || roleRow.level !== 1) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    next();
  } catch (err) {
    console.error('isSuperAdmin error:', err);
    res.status(500).json({ error: err.message });
  }
};

export default {
  checkPermission,
  checkRole,
  logActivity,
  isAdmin,
  isSuperAdmin,
};