// ============================================
// queueRoutes.js
// File: backend/src/routes/queueRoutes.js
// ============================================
import express from 'express';
import {
  getTodayQueue,
  getNextPatient,
  getQueueStats,
  checkInPatient,
  updateQueueStatus,
  updateQueueEntry,
  removeFromQueue,
  getPatientQueueHistory,
} from '../controllers/queueController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

const clinical = authorize('admin', 'doctor', 'nurse', 'receptionist');
const staff    = authorize('admin', 'doctor', 'nurse', 'receptionist');

// ── GET ───────────────────────────────────────────────────────────────────────
router.get('/',                        clinical, getTodayQueue);
router.get('/next',                    clinical, getNextPatient);
router.get('/stats',                   clinical, getQueueStats);
router.get('/patient/:patientId',      clinical, getPatientQueueHistory);

// ── POST ──────────────────────────────────────────────────────────────────────
router.post('/check-in',               staff,    checkInPatient);

// ── PUT ───────────────────────────────────────────────────────────────────────
router.put('/:id/status',              staff,    updateQueueStatus);
router.put('/:id',                     staff,    updateQueueEntry);

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id',                  staff,    removeFromQueue);

export default router;