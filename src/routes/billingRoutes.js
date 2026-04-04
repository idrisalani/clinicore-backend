// ============================================
// Billing Routes — COMPLETE UPDATED FILE
// File: backend/src/routes/billingRoutes.js
// ============================================

import express from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  getPayments,
  getAllServices,
  createService,
  getBillingStats,
  // ── NEW: Financial Report endpoints ──
  getRevenueReport,
  getRevenueByService,
  getOutstandingReport,
  getFinancialSummary,
} from '../controllers/billingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All billing routes require authentication
router.use(authenticate);

// ==========================================
// INVOICE ROUTES
// ==========================================
router.get('/invoices',     getAllInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices',    createInvoice);
router.put('/invoices/:id', updateInvoice);
router.delete('/invoices/:id', deleteInvoice);

// ==========================================
// PAYMENT ROUTES
// ==========================================
router.post('/payments', recordPayment);
router.get('/payments',  getPayments);

// ==========================================
// SERVICE ROUTES
// ==========================================
router.get('/services',  getAllServices);
router.post('/services', createService);

// ==========================================
// STATS & REPORTS — ORDER MATTERS:
// specific paths before :id wildcards
// ==========================================
router.get('/stats/overview',          getBillingStats);

// ── NEW Financial Report Routes ──────────
router.get('/reports/summary',         getFinancialSummary);
router.get('/reports/revenue',         getRevenueReport);
router.get('/reports/by-service',      getRevenueByService);
router.get('/reports/outstanding',     getOutstandingReport);

export default router;