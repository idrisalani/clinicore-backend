import { verifyAccessToken } from '../utils/security.js';
import { query } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Auth header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');

    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid header format');
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.substring(7);
    console.log('✅ Token extracted:', token.substring(0, 20) + '...');

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
      console.log('✅ Token verified, user_id:', decoded.user_id);
    } catch (tokenError) {
      console.log('❌ Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user from database - ADD AWAIT HERE!
    try {
      const result = await query(
        'SELECT user_id, username, email, role, is_active FROM users WHERE user_id = ?',
        [decoded.user_id]
      );

      console.log('✅ Query result:', result);

      if (!result.rows || result.rows.length === 0) {
        console.log('❌ User not found:', decoded.user_id);
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        console.log('❌ User inactive:', decoded.user_id);
        return res.status(401).json({ error: 'User account is inactive' });
      }

      console.log('✅ User authenticated:', user.username);
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
    if (!req.user || !roles.includes(req.user.role)) {
      console.log('❌ Authorization failed for user:', req.user?.username);
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};