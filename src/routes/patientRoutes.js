import express from 'express';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  searchPatients,
  getPatientMedicalHistory,
  getPatientStats,
  getMyProfile,
  updateMyProfile,
} from '../controllers/patientController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All patient routes require authentication
router.use(authenticate);

// ── Self-service (MUST be before /:id to avoid param conflict) ───────────────
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);

// ── Stats & search (also before /:id) ────────────────────────────────────────
router.get('/stats/overview', getPatientStats);
router.get('/search',         searchPatients);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/',    getAllPatients);
router.post('/',   createPatient);

router.get('/:id',                   getPatientById);
router.get('/:id/medical-history',   getPatientMedicalHistory);
router.put('/:id',                   updatePatient);
router.delete('/:id',                deletePatient);

export default router;