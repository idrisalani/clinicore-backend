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
} from '../controllers/billingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All billing routes require authentication
router.use(authenticate);

// ==========================================
// INVOICE ROUTES
// ==========================================

// Get all invoices
router.get('/invoices', getAllInvoices);

// Get billing statistics
router.get('/stats/overview', getBillingStats);

// Get single invoice
router.get('/invoices/:id', getInvoiceById);

// Create invoice
router.post('/invoices', createInvoice);

// Update invoice
router.put('/invoices/:id', updateInvoice);

// Delete invoice
router.delete('/invoices/:id', deleteInvoice);

// ==========================================
// PAYMENT ROUTES
// ==========================================

// Record payment
router.post('/payments', recordPayment);

// Get payments
router.get('/payments', getPayments);

// ==========================================
// SERVICE ROUTES
// ==========================================

// Get all services
router.get('/services', getAllServices);

// Create service
router.post('/services', createService);

export default router;