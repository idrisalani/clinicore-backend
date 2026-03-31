import express from 'express';
import {
  getAllConsultations,
  getConsultationById,
  getPatientConsultations,
  createConsultation,
  updateConsultation,
  deleteConsultation,
  getConsultationStats,
} from '../controllers/consultationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All consultation routes require authentication
router.use(authenticate);

// ==========================================
// GET Endpoints
// ==========================================

// Get all consultations with pagination
router.get('/', getAllConsultations);

// Get consultation statistics
router.get('/stats/overview', getConsultationStats);

// Get patient consultations
router.get('/patient/:patientId', getPatientConsultations);

// Get single consultation
router.get('/:id', getConsultationById);

// ==========================================
// POST Endpoints
// ==========================================

// Create new consultation
router.post('/', createConsultation);

// ==========================================
// PUT Endpoints
// ==========================================

// Update consultation
router.put('/:id', updateConsultation);

// ==========================================
// DELETE Endpoints
// ==========================================

// Delete consultation
router.delete('/:id', deleteConsultation);

export default router;