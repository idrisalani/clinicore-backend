// ============================================
// auth.js — Authentication & Authorization middleware
// File: backend/src/middleware/auth.js
// ============================================

import { verifyAccessToken } from '../utils/security.js';
import { query } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    const token = authHeader.substring(7);

    // Guard: reject obviously bad tokens before hitting JWT verify
    if (!token || token === 'null' || token === 'undefined' || token.length < 10) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (tokenError) {
      console.log('❌ Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
      const result = await query(
        'SELECT user_id, username, email, role, full_name, is_active FROM users WHERE user_id = ?',
        [decoded.user_id]
      );

      if (!result.rows?.length) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'User account is inactive' });
      }

      req.user = user;
      next();
    } catch (dbError) {
      console.error('❌ Database error during auth:', dbError);
      res.status(500).json({ error: 'Authentication database error' });
    }
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    // Case-insensitive role check — guards against 'Admin' vs 'admin' mismatches
    const userRole = req.user.role?.toLowerCase();
    const allowed  = roles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      console.log(`❌ Authorization failed: user role '${req.user.role}' not in [${roles.join(', ')}]`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};