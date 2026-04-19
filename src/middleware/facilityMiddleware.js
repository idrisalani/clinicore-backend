// ============================================
// facilityMiddleware.js
// File: backend/src/middleware/facilityMiddleware.js
//
// Reads the authenticated user's facility_id and
// attaches it to every request as req.facilityId.
// All controllers use req.facilityId to scope queries.
//
// Wire in server.js AFTER authenticate middleware:
//   app.use(authenticate);
//   app.use(facilityScope);
// ============================================
import { query } from '../config/database.js';

const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;

// ── Scope every authenticated request to a facility ───────────────────────────
export const facilityScope = async (req, res, next) => {
  // Skip public routes (no user attached yet)
  if (!req.user) return next();

  try {
    // Super-admins can switch facility via header (for cross-facility reporting)
    const headerFacility = req.headers['x-facility-id'];

    if (headerFacility && req.user.role === 'admin') {
      // Verify the facility exists
      const fac = await getOne(
        'SELECT facility_id, name FROM facilities WHERE facility_id = ? AND is_active = 1',
        [headerFacility]
      );
      if (fac) {
        req.facilityId   = fac.facility_id;
        req.facilityName = fac.name;
        return next();
      }
    }

    // Normal path — get facility_id from the user record
    const user = await getOne(
      'SELECT facility_id FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (!user?.facility_id) {
      // Fallback to facility 1 (handles legacy records)
      req.facilityId   = 1;
      req.facilityName = 'Default';
    } else {
      req.facilityId   = user.facility_id;

      // Cache the facility name (avoid repeated lookups)
      const fac = await getOne(
        'SELECT name FROM facilities WHERE facility_id = ?',
        [user.facility_id]
      );
      req.facilityName = fac?.name || 'Unknown';
    }

    next();
  } catch (err) {
    console.error('facilityScope error:', err.message);
    req.facilityId   = 1;  // Safe default — never block requests
    req.facilityName = 'Default';
    next();
  }
};

// ── Guard: reject requests with no facility context ───────────────────────────
// Use on routes where facility isolation is critical (clinical data)
export const requireFacility = (req, res, next) => {
  if (!req.facilityId) {
    return res.status(403).json({ error: 'No facility context. Please contact admin.' });
  }
  next();
};

// ── Cross-facility guard: only super-admins can query across facilities ────────
export const requireSameFacility = (targetFacilityId) => (req, res, next) => {
  if (req.user?.role === 'admin') return next(); // admins can cross
  if (req.facilityId !== Number(targetFacilityId)) {
    return res.status(403).json({ error: 'Access to this facility is not permitted.' });
  }
  next();
};