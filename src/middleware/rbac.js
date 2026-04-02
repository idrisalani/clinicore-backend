// ============================================
// RBAC Middleware - Permission & Role Checking
// File: backend/src/middleware/rbac.js
// ============================================

import db from '../config/database.js';

// ============================================
// CHECK PERMISSION MIDDLEWARE
// ============================================

export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Get user from request (set by auth middleware)
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      // Get user's role
      const userRow = await db.get(
        'SELECT role FROM users WHERE user_id = ?',
        [userId]
      );

      if (!userRow) {
        return res.status(401).json({error: 'User not found'});
      }

      // Get all permissions for user's role
      const permissionsRows = await db.all(`
        SELECT p.name FROM permissions p
        JOIN role_permissions rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id = ?
      `, [userRow.role]);

      const permissions = permissionsRows.map(p => p.name);

      // Check if user has required permission
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermission,
          have: permissions
        });
      }

      // Permission granted, proceed
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({error: err.message});
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
      
      if (!userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const userRow = await db.get(
        'SELECT role FROM users WHERE user_id = ?',
        [userId]
      );

      if (!userRow) {
        return res.status(401).json({error: 'User not found'});
      }

      // Convert string to array if needed
      const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

      if (!rolesArray.includes(userRow.role)) {
        return res.status(403).json({
          error: 'Insufficient role',
          required: rolesArray,
          have: userRow.role
        });
      }

      next();
    } catch (err) {
      console.error('Role check error:', err);
      res.status(500).json({error: err.message});
    }
  };
};

// ============================================
// ACTIVITY LOGGING MIDDLEWARE
// ============================================

export const logActivity = (action, resource) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const resourceId = req.params.id || null;

      // Log after response is sent
      res.on('finish', async () => {
        try {
          await db.run(`
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
            VALUES (?, ?, ?, ?, ?)
          `, [userId, action, resource, resourceId, ipAddress]);
        } catch (err) {
          console.error('Activity logging error:', err);
        }
      });

      next();
    } catch (err) {
      // Log errors but don't block request
      console.error('Logging setup error:', err);
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
    
    if (!userId) {
      return res.status(401).json({error: 'Unauthorized'});
    }

    const userRow = await db.get(
      'SELECT role FROM users WHERE user_id = ?',
      [userId]
    );

    if (!userRow || userRow.role !== 'admin') {
      return res.status(403).json({error: 'Admin access required'});
    }

    next();
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

// ============================================
// IS SUPER ADMIN MIDDLEWARE
// ============================================

export const isSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({error: 'Unauthorized'});
    }

    const userRow = await db.get(
      'SELECT role FROM users WHERE user_id = ?',
      [userId]
    );

    // Check role level (Super Admin should be level 1)
    const roleRow = await db.get(
      'SELECT level FROM roles WHERE role_name = ?',
      [userRow.role]
    );

    if (!roleRow || roleRow.level !== 1) {
      return res.status(403).json({error: 'Super admin access required'});
    }

    next();
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

export default {
  checkPermission,
  checkRole,
  logActivity,
  isAdmin,
  isSuperAdmin
};