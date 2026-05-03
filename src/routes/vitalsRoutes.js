// ============================================
// vitalsRoutes.js
// File: backend/src/routes/vitalsRoutes.js
// Mount: app.use('/api/v1/vitals', vitalsRoutes)
// ============================================
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  recordVitals, getVitalsByVisit,
  getVitalsByPatient, updateVitals,
} from '../controllers/vitalsController.js';

const router = express.Router();
router.use(authenticate);

const nurse    = authorize('admin','nurse','doctor');
const clinical = authorize('admin','doctor','nurse','receptionist');

router.post('/',                       nurse,    recordVitals);
router.get('/visit/:visitId',          clinical, getVitalsByVisit);
router.get('/patient/:patientId',      clinical, getVitalsByPatient);
router.put('/:id',                     nurse,    updateVitals);

export default router;