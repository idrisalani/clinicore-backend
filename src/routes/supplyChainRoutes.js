// ============================================
// supplyChainRoutes.js
// File: backend/src/routes/supplyChainRoutes.js
// Mount: app.use('/api/v1/supply-chain', supplyChainRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllSuppliers, getSupplierById, createSupplier, updateSupplier,
  getAllPOs, getPOById, createPO, updatePOStatus, deletePO,
  getAllGRNs, createGRN,
  getStockMovements, adjustStock,
  getSupplyStats,
} from '../controllers/supplyChainController.js';

const router = express.Router();
router.use(authenticate);

const clinical = authorize('admin', 'pharmacist', 'doctor', 'nurse');
const manager  = authorize('admin', 'pharmacist');
const admin    = authorize('admin');

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats',                    clinical, getSupplyStats);

// ── Suppliers ─────────────────────────────────────────────────────────────────
router.get('/suppliers',                clinical, getAllSuppliers);
router.get('/suppliers/:id',            clinical, getSupplierById);
router.post('/suppliers',               manager,  createSupplier);
router.put('/suppliers/:id',            manager,  updateSupplier);

// ── Purchase Orders ───────────────────────────────────────────────────────────
router.get('/purchase-orders',          clinical, getAllPOs);
router.get('/purchase-orders/:id',      clinical, getPOById);
router.post('/purchase-orders',         manager,  createPO);
router.put('/purchase-orders/:id/status', manager, updatePOStatus);
router.delete('/purchase-orders/:id',   admin,    deletePO);

// ── Goods Received ────────────────────────────────────────────────────────────
router.get('/grn',                      clinical, getAllGRNs);
router.post('/grn',                     manager,  createGRN);

// ── Stock movements + manual adjustment ──────────────────────────────────────
router.get('/stock-movements',          clinical, getStockMovements);
router.post('/stock-movements/adjust',  manager,  adjustStock);

export default router;