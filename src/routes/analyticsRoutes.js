// ============================================
// analyticsRoutes.js
// File: backend/src/routes/analyticsRoutes.js
// Mount: app.use('/api/v1/analytics', analyticsRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getOverview, getRevenueTrend, getPatientAnalytics,
  getClinicalAnalytics, getAppointmentAnalytics,
  getPaymentMethodBreakdown, getOutstandingReport,
} from '../controllers/analyticsController.js';

const router = express.Router();
router.use(authenticate);

const admin      = authorize('admin');
const management = authorize('admin', 'doctor');

router.get('/overview',          management, getOverview);
router.get('/revenue',           admin,      getRevenueTrend);
router.get('/patients',          management, getPatientAnalytics);
router.get('/clinical',          management, getClinicalAnalytics);
router.get('/appointments',      management, getAppointmentAnalytics);
router.get('/payment-methods',   admin,      getPaymentMethodBreakdown);
router.get('/outstanding',       admin,      getOutstandingReport);

export default router;