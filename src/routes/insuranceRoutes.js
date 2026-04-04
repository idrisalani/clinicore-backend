// ============================================
// Insurance Routes
// File: backend/src/routes/insuranceRoutes.js
// ============================================

import express from 'express';
import {
  getAllClaims, getClaimStats, getClaimById,
  getClaimsByInvoice, createClaim,
  updateClaimStatus, updateClaim, deleteClaim,
} from '../controllers/insuranceController.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, logActivity } from '../middleware/rbac.js';

const router = express.Router();
router.use(authenticate);

// ── Stats (before :id to avoid route conflict) ────────────────────────────────
router.get('/stats',                    checkPermission('view_billing'),   getClaimStats);

// ── List & single ─────────────────────────────────────────────────────────────
router.get('/',                         checkPermission('view_billing'),   getAllClaims);
router.get('/invoice/:invoiceId',       checkPermission('view_billing'),   getClaimsByInvoice);
router.get('/:id',                      checkPermission('view_billing'),   getClaimById);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/',
  checkPermission('create_billing'),
  logActivity('CREATE', 'InsuranceClaim'),
  createClaim
);

// ── Update status (dedicated endpoint for quick status changes) ───────────────
router.put('/:id/status',
  checkPermission('edit_billing'),
  logActivity('UPDATE', 'InsuranceClaim'),
  updateClaimStatus
);

// ── Update full details ───────────────────────────────────────────────────────
router.put('/:id',
  checkPermission('edit_billing'),
  logActivity('UPDATE', 'InsuranceClaim'),
  updateClaim
);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id',
  checkPermission('delete_billing'),
  logActivity('DELETE', 'InsuranceClaim'),
  deleteClaim
);

export default router;