// ============================================
// visitRoutes.js
// File: backend/src/routes/visitRoutes.js
// Mount: app.use('/api/v1/visits', visitRoutes)
//        app.use('/api/v1/vitals', vitalsRoutes)  ← separate file
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createVisit, getTodaysVisits, getVisitById,
  updateVisitStatus, getPatientVisits, getPatientTimeline,
} from '../controllers/visitController.js';

const router = express.Router();
router.use(authenticate);

const receptionist = authorize('admin','receptionist');
const nurse        = authorize('admin','nurse','doctor');
const clinical     = authorize('admin','doctor','nurse','receptionist','lab_tech','pharmacist');
const doctor       = authorize('admin','doctor');

// ── Visit CRUD ────────────────────────────────────────────────────────────────
router.post('/',                    receptionist, createVisit);
router.get('/today',                clinical,     getTodaysVisits);
router.get('/patient/:patientId',   clinical,     getPatientVisits);
router.get('/:id',                  clinical,     getVisitById);
router.put('/:id/status',           nurse,        updateVisitStatus);

// ── Patient timeline (doctor full history) ────────────────────────────────────
// Mounted on /api/v1/patients/:id/timeline via patientRoutes OR here
router.get('/timeline/:patientId',  doctor,       getPatientTimeline);

export default router;