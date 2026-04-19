// ============================================
// facilityRoutes.js
// File: backend/src/routes/facilityRoutes.js
// Mount: app.use('/api/v1/facilities', facilityRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllFacilities, getCurrentFacility, getFacilityById,
  createFacility, updateFacility, deactivateFacility, getFacilityStats,
} from '../controllers/facilityController.js';

const router = express.Router();
router.use(authenticate);

const admin    = authorize('admin');
const clinical = authorize('admin', 'doctor', 'nurse', 'pharmacist', 'receptionist', 'lab_tech');

// ── Current facility (for all staff) ─────────────────────────────────────────
router.get('/current',       clinical, getCurrentFacility);
router.get('/current/stats', clinical, getFacilityStats);
router.put('/current',       admin,    updateFacility);   // updates req.facilityId facility

// ── Cross-facility admin routes ────────────────────────────────────────────────
router.get('/',              admin, getAllFacilities);
router.post('/',             admin, createFacility);
router.get('/:id',           admin, getFacilityById);
router.get('/:id/stats',     admin, getFacilityStats);
router.put('/:id',           admin, updateFacility);
router.put('/:id/deactivate',admin, deactivateFacility);

export default router;