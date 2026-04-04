// ============================================
// Pharmacy Routes — COMPLETE UPDATED FILE
// File: backend/src/routes/pharmacyRoutes.js
// ============================================

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
  // ── NEW: Drug Expiry endpoints ──
  getMedicationExpiry,
  getLowStockMedications,
  updateMedicationInventory,
} from '../controllers/pharmacyController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All pharmacy routes require authentication
router.use(authenticate);

// ==========================================
// PRESCRIPTION ROUTES
// ==========================================
router.get('/prescriptions',                     getAllPrescriptions);
router.get('/prescriptions/patient/:patientId',  getPatientPrescriptions);
router.get('/prescriptions/:id',                 getPrescriptionById);
router.post('/prescriptions',                    createPrescription);
router.put('/prescriptions/:id',                 updatePrescription);
router.delete('/prescriptions/:id',              deletePrescription);

// ==========================================
// MEDICATION ROUTES
// ORDER MATTERS: specific paths before :id
// ==========================================
router.get('/medications',              getAllMedications);
router.get('/medications/expiry',       getMedicationExpiry);       // ← NEW
router.get('/medications/low-stock',    getLowStockMedications);    // ← NEW
router.get('/medications/:id',          getMedicationById);
router.post('/medications',             createMedication);
router.put('/medications/:id/inventory', updateMedicationInventory); // ← NEW

// ==========================================
// STATS
// ==========================================
router.get('/stats/overview', getPharmacyStats);

export default router;