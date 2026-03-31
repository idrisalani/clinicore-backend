import express from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPatientAppointments,
  getDoctorAvailability,
  getAppointmentStats,
} from '../controllers/appointmentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All appointment routes require authentication
router.use(authenticate);

// ==========================================
// GET Endpoints
// ==========================================

// Get all appointments with filters
router.get('/', getAllAppointments);

// Get appointment statistics
router.get('/stats/overview', getAppointmentStats);

// Get doctor availability/calendar
router.get('/doctor/:doctorId/availability', getDoctorAvailability);

// Get patient appointments
router.get('/patient/:patientId', getPatientAppointments);

// Get single appointment
router.get('/:id', getAppointmentById);

// ==========================================
// POST Endpoints
// ==========================================

// Create new appointment
router.post('/', createAppointment);

// ==========================================
// PUT Endpoints
// ==========================================

// Update appointment
router.put('/:id', updateAppointment);

// ==========================================
// DELETE Endpoints
// ==========================================

// Cancel/Delete appointment
router.delete('/:id', deleteAppointment);

export default router;