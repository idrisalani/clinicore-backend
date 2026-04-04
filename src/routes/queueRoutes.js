// ============================================
// Queue Routes
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
import { authenticate } from '../middleware/auth.js';
import { checkPermission, logActivity } from '../middleware/rbac.js';

const router = express.Router();

// All queue routes require authentication
router.use(authenticate);

// ── GET endpoints ─────────────────────────────────────────────────────────────
router.get('/',
  checkPermission('view_appointments'),
  getTodayQueue
);

router.get('/next',
  checkPermission('view_appointments'),
  getNextPatient
);

router.get('/stats',
  checkPermission('view_appointments'),
  getQueueStats
);

router.get('/patient/:patientId',
  checkPermission('view_appointments'),
  getPatientQueueHistory
);

// ── POST endpoints ────────────────────────────────────────────────────────────
router.post('/check-in',
  checkPermission('create_appointment'),
  logActivity('CREATE', 'Queue'),
  checkInPatient
);

// ── PUT endpoints ─────────────────────────────────────────────────────────────
router.put('/:id/status',
  checkPermission('edit_appointment'),
  logActivity('UPDATE', 'Queue'),
  updateQueueStatus
);

router.put('/:id',
  checkPermission('edit_appointment'),
  logActivity('UPDATE', 'Queue'),
  updateQueueEntry
);

// ── DELETE endpoints ──────────────────────────────────────────────────────────
router.delete('/:id',
  checkPermission('delete_appointment'),
  logActivity('DELETE', 'Queue'),
  removeFromQueue
);

export default router;