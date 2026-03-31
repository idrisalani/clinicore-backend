import express from 'express';
import {
  getAllLabOrders,
  getLabOrderById,
  getPatientLabOrders,
  createLabOrder,
  updateLabOrder,
  deleteLabOrder,
  addLabResult,
  getLabStats,
} from '../controllers/labController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All lab routes require authentication
router.use(authenticate);

// ==========================================
// GET Endpoints
// ==========================================

// Get all lab orders with pagination
router.get('/', getAllLabOrders);

// Get lab statistics
router.get('/stats/overview', getLabStats);

// Get patient lab orders
router.get('/patient/:patientId', getPatientLabOrders);

// Get single lab order with results
router.get('/:id', getLabOrderById);

// ==========================================
// POST Endpoints
// ==========================================

// Create new lab order
router.post('/', createLabOrder);

// Add lab result to an order
router.post('/:id/results', addLabResult);

// ==========================================
// PUT Endpoints
// ==========================================

// Update lab order
router.put('/:id', updateLabOrder);

// ==========================================
// DELETE Endpoints
// ==========================================

// Delete lab order
router.delete('/:id', deleteLabOrder);

export default router;