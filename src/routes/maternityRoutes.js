// ============================================
// maternityRoutes.js
// File: backend/src/routes/maternityRoutes.js
// Mount: app.use('/api/v1/maternity', maternityRoutes)
// ============================================

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllCases, getCaseById, getPatientCases,
  createCase, updateCase, getMaternityStats,
  addANCVisit, updateANCVisit,
  recordDelivery, updateDelivery,
} from '../controllers/maternityController.js';

const router = express.Router();
router.use(authenticate);

const clinical = authorize('admin', 'doctor', 'nurse', 'receptionist');
const doctors  = authorize('admin', 'doctor', 'nurse');

// ── Cases ─────────────────────────────────────────────────────────────────────
router.get('/',                          clinical, getAllCases);
router.get('/stats',                     clinical, getMaternityStats);
router.get('/patient/:patientId',        clinical, getPatientCases);
router.get('/:id',                       clinical, getCaseById);
router.post('/',                         doctors,  createCase);
router.put('/:id',                       doctors,  updateCase);

// ── ANC Visits ────────────────────────────────────────────────────────────────
router.post('/:id/visits',               doctors,  addANCVisit);
router.put('/visits/:visitId',           doctors,  updateANCVisit);

// ── Delivery Records ──────────────────────────────────────────────────────────
router.post('/:id/delivery',             doctors,  recordDelivery);
router.put('/delivery/:deliveryId',      doctors,  updateDelivery);

export default router;