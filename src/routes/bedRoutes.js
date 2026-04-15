// ============================================
// bedRoutes.js
// File: backend/src/routes/bedRoutes.js
// Mount: app.use('/api/v1/beds', bedRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllWards, getWardById, createWard, updateWard,
  getAllBeds, getBedById, createBed, updateBedStatus, deleteBed,
  getAllAdmissions, getAdmissionById, admitPatient,
  dischargePatient, transferPatient,
  getBedStats, getPatientAdmissions,
} from '../controllers/bedController.js';

const router = express.Router();
router.use(authenticate);

const clinical = authorize('admin', 'doctor', 'nurse', 'receptionist');
const doctors  = authorize('admin', 'doctor', 'nurse');
const admin    = authorize('admin');

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats',                           clinical, getBedStats);

// ── Wards ─────────────────────────────────────────────────────────────────────
router.get('/wards',                           clinical, getAllWards);
router.get('/wards/:id',                       clinical, getWardById);
router.post('/wards',                          admin,    createWard);
router.put('/wards/:id',                       admin,    updateWard);

// ── Beds ──────────────────────────────────────────────────────────────────────
router.get('/',                                clinical, getAllBeds);
router.get('/:id',                             clinical, getBedById);
router.post('/',                               admin,    createBed);
router.put('/:id/status',                      doctors,  updateBedStatus);
router.delete('/:id',                          admin,    deleteBed);

// ── Admissions ────────────────────────────────────────────────────────────────
router.get('/admissions',                      clinical, getAllAdmissions);
router.get('/admissions/:id',                  clinical, getAdmissionById);
router.get('/patient/:patientId/admissions',   clinical, getPatientAdmissions);
router.post('/admissions',                     doctors,  admitPatient);
router.put('/admissions/:id/discharge',        doctors,  dischargePatient);
router.put('/admissions/:id/transfer',         doctors,  transferPatient);

export default router;