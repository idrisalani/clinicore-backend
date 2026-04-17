// ============================================
// schedulingRoutes.js
// File: backend/src/routes/schedulingRoutes.js
// Mount: app.use('/api/v1/scheduling', schedulingRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getTemplates, createTemplate,
  getSchedules, getMySchedule, createSchedule, bulkCreateSchedule,
  updateSchedule, deleteSchedule, checkIn, checkOut,
  getSwapRequests, requestSwap, respondToSwap,
  getLeaveRequests, requestLeave, reviewLeave,
  getSchedulingStats,
} from '../controllers/schedulingController.js';

const router = express.Router();
router.use(authenticate);

const all    = authorize('admin','doctor','nurse','pharmacist','receptionist','lab_tech');
const admin  = authorize('admin');
const mgmt   = authorize('admin','doctor');

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats',                    all,   getSchedulingStats);

// ── Templates ─────────────────────────────────────────────────────────────────
router.get('/templates',                all,   getTemplates);
router.post('/templates',               admin, createTemplate);

// ── Schedules ─────────────────────────────────────────────────────────────────
router.get('/my',                       all,   getMySchedule);
router.get('/',                         all,   getSchedules);
router.post('/',                        mgmt,  createSchedule);
router.post('/bulk',                    mgmt,  bulkCreateSchedule);
router.put('/:id',                      mgmt,  updateSchedule);
router.delete('/:id',                   mgmt,  deleteSchedule);
router.post('/:id/check-in',            all,   checkIn);
router.post('/:id/check-out',           all,   checkOut);

// ── Shift swaps ───────────────────────────────────────────────────────────────
router.get('/swaps',                    all,   getSwapRequests);
router.post('/swaps',                   all,   requestSwap);
router.put('/swaps/:id',                all,   respondToSwap);

// ── Leave requests ────────────────────────────────────────────────────────────
router.get('/leaves',                   all,   getLeaveRequests);
router.post('/leaves',                  all,   requestLeave);
router.put('/leaves/:id/review',        mgmt,  reviewLeave);

export default router;