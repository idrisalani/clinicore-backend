// ============================================
// telemedicineRoutes.js
// File: backend/src/routes/telemedicineRoutes.js
// Mount: app.use('/api/v1/telemedicine', telemedicineRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createSession, getSessions, getSessionById,
  startSession, endSession, cancelSession, getStats,
} from '../controllers/telemedicineController.js';

const router = express.Router();
router.use(authenticate);

const staff   = authorize('admin', 'doctor', 'nurse', 'receptionist');
const doctors = authorize('admin', 'doctor');

router.get('/stats',             doctors, getStats);
router.get('/sessions',          staff,   getSessions);
router.get('/sessions/:id',      authenticate, getSessionById);   // patients can also GET
router.post('/sessions',         staff,   createSession);
router.post('/sessions/:id/start', doctors, startSession);
router.post('/sessions/:id/end',   doctors, endSession);
router.delete('/sessions/:id',   doctors, cancelSession);

export default router;