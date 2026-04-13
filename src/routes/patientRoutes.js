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
} from '../controllers/patientController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All patient routes require authentication
router.use(authenticate);

// ==========================================
// GET Endpoints
// ==========================================

// Get all patients with pagination & search
router.get('/', getAllPatients);

// Get patient statistics
router.get('/stats/overview', getPatientStats);

// Search patients
router.get('/search', searchPatients);

// Get patient by ID with related data
router.get('/:id', getPatientById);

// Get patient medical history
router.get('/:id/medical-history', getPatientMedicalHistory);

// ==========================================
// POST Endpoints
// ==========================================

// Create new patient
router.post('/', createPatient);

// ==========================================
// PUT Endpoints
// ==========================================

// Update patient
router.put('/:id', updatePatient);

// ==========================================
// DELETE Endpoints
// ==========================================

// Delete patient (soft delete)
router.delete('/:id', deletePatient);

// Patient self-service — must be before /:id to avoid param conflict
router.get('/me',     authenticate, getMyProfile);
router.put('/me',     authenticate, updateMyProfile);

export default router;