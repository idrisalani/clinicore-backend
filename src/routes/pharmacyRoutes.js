import express from 'express';
import {
  getAllPrescriptions,
  getPrescriptionById,
  getPatientPrescriptions,
  createPrescription,
  updatePrescription,
  deletePrescription,
  getAllMedications,
  getMedicationById,
  createMedication,
  getPharmacyStats,
} from '../controllers/pharmacyController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All pharmacy routes require authentication
router.use(authenticate);

// ==========================================
// PRESCRIPTION ROUTES
// ==========================================

// Get all prescriptions
router.get('/prescriptions', getAllPrescriptions);

// Get prescription statistics
router.get('/stats/overview', getPharmacyStats);

// Get patient prescriptions
router.get('/prescriptions/patient/:patientId', getPatientPrescriptions);

// Get single prescription
router.get('/prescriptions/:id', getPrescriptionById);

// Create prescription
router.post('/prescriptions', createPrescription);

// Update prescription
router.put('/prescriptions/:id', updatePrescription);

// Delete prescription
router.delete('/prescriptions/:id', deletePrescription);

// ==========================================
// MEDICATION ROUTES
// ==========================================

// Get all medications
router.get('/medications', getAllMedications);

// Get single medication
router.get('/medications/:id', getMedicationById);

// Create medication
router.post('/medications', createMedication);

export default router;