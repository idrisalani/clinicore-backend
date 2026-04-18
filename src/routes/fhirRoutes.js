// ============================================
// fhirRoutes.js
// File: backend/src/routes/fhirRoutes.js
// Mount: app.use('/api/v1/fhir', fhirRoutes)
//
// Implements a subset of FHIR R4 RESTful API:
//   GET /fhir/metadata               — CapabilityStatement
//   GET /fhir/Patient/:id            — Single patient
//   GET /fhir/Patient                — Search patients
//   GET /fhir/Patient/:id/$summary   — Full patient summary Bundle
//   GET /fhir/Encounter/:id          — Single consultation
//   GET /fhir/Observation/:id        — Single lab result
//   GET /fhir/MedicationRequest/:id  — Single medication
//   GET /fhir/Appointment/:id        — Single appointment
// ============================================
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';
import {
  toFHIRPatient, toFHIREncounter, toFHIRObservation,
  toFHIRMedicationRequest, toFHIRAppointment,
  toFHIRBundle, toFHIRPatientSummary,
} from '../utils/fhirMapper.js';

const router = express.Router();
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── FHIR content-type header ──────────────────────────────────────────────────
router.use((req, res, next) => {
  res.set('Content-Type', 'application/fhir+json; charset=utf-8');
  next();
});

// ── /metadata — CapabilityStatement (no auth required) ───────────────────────
router.get('/metadata', (req, res) => {
  res.json({
    resourceType: 'CapabilityStatement',
    status:  'active',
    date:    new Date().toISOString(),
    kind:    'instance',
    fhirVersion: '4.0.1',
    format:  ['application/fhir+json'],
    software: {
      name:    'CliniCore FHIR API',
      version: '1.0.0',
    },
    implementation: {
      description: 'CliniCore Healthcare Management System — Lagos, Nigeria',
    },
    rest: [{
      mode: 'server',
      resource: [
        { type:'Patient',           interaction:[{code:'read'},{code:'search-type'}] },
        { type:'Encounter',         interaction:[{code:'read'}] },
        { type:'Observation',       interaction:[{code:'read'}] },
        { type:'MedicationRequest', interaction:[{code:'read'}] },
        { type:'Appointment',       interaction:[{code:'read'}] },
      ],
      operation: [{
        name:       '$summary',
        definition: 'Patient summary bundle',
      }],
    }],
  });
});

// All other FHIR routes require auth
router.use(authenticate);

// ── FHIR error helper ─────────────────────────────────────────────────────────
const fhirError = (res, status, code, msg) => res.status(status).json({
  resourceType:  'OperationOutcome',
  issue: [{ severity:'error', code, details:{ text: msg } }],
});

// ── Patient ───────────────────────────────────────────────────────────────────
router.get('/Patient', async (req, res) => {
  try {
    const { family, given, phone, identifier, _count = 20 } = req.query;
    let where = ['p.is_active = 1'];
    const params = [];
    if (family)     { where.push('p.last_name LIKE ?');     params.push(`%${family}%`);     }
    if (given)      { where.push('p.first_name LIKE ?');    params.push(`%${given}%`);      }
    if (phone)      { where.push('p.phone LIKE ?');         params.push(`%${phone}%`);      }
    if (identifier) { where.push('p.patient_number = ?');   params.push(identifier);        }

    const rows = await getAll(
      `SELECT p.* FROM patients p WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT ?`,
      [...params, Math.min(+_count, 100)]
    );

    const entries = rows.map(p => ({
      fullUrl:  `${process.env.FHIR_BASE_URL || ''}/Patient/${p.patient_id}`,
      resource: toFHIRPatient(p),
    }));

    res.json({
      resourceType: 'Bundle',
      type:         'searchset',
      total:        rows.length,
      entry:        entries,
    });
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

router.get('/Patient/:id', async (req, res) => {
  try {
    const p = await getOne(
      'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [req.params.id]
    );
    if (!p) return fhirError(res, 404, 'not-found', `Patient/${req.params.id} not found`);
    res.json(toFHIRPatient(p));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// Patient summary operation — returns Bundle with all resources
router.get('/Patient/:id/\\$summary', async (req, res) => {
  try {
    const { id } = req.params;
    const [patient, consultations, labOrders, medications] = await Promise.all([
      getOne('SELECT * FROM patients WHERE patient_id = ? AND is_active = 1', [id]),
      getAll('SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC LIMIT 20', [id]),
      getAll('SELECT * FROM lab_orders WHERE patient_id = ? ORDER BY ordered_date DESC LIMIT 20', [id]),
      getAll('SELECT * FROM medications WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20', [id]),
    ]);
    if (!patient) return fhirError(res, 404, 'not-found', `Patient/${id} not found`);
    res.json(toFHIRPatientSummary(patient, consultations, labOrders, medications));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// ── Encounter ─────────────────────────────────────────────────────────────────
router.get('/Encounter/:id', async (req, res) => {
  try {
    const c = await getOne('SELECT * FROM consultations WHERE consultation_id = ?', [req.params.id]);
    if (!c) return fhirError(res, 404, 'not-found', `Encounter/${req.params.id} not found`);
    res.json(toFHIREncounter(c));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// Search Encounters by patient
router.get('/Encounter', async (req, res) => {
  try {
    const { patient, _count = 20 } = req.query;
    if (!patient) return fhirError(res, 400, 'required', 'patient parameter is required');
    const patId = patient.replace('Patient/', '');
    const rows  = await getAll(
      'SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC LIMIT ?',
      [patId, Math.min(+_count, 100)]
    );
    res.json(toFHIRBundle('searchset', rows.map(c => toFHIREncounter(c, patId))));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// ── Observation ───────────────────────────────────────────────────────────────
router.get('/Observation/:id', async (req, res) => {
  try {
    const lo = await getOne('SELECT * FROM lab_orders WHERE lab_order_id = ?', [req.params.id]);
    if (!lo) return fhirError(res, 404, 'not-found', `Observation/${req.params.id} not found`);
    const lr = await getOne('SELECT * FROM lab_results WHERE lab_order_id = ? LIMIT 1', [lo.lab_order_id]);
    res.json(toFHIRObservation(lo, lr));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// Search Observations by patient
router.get('/Observation', async (req, res) => {
  try {
    const { patient, _count = 20 } = req.query;
    if (!patient) return fhirError(res, 400, 'required', 'patient parameter is required');
    const patId = patient.replace('Patient/', '');
    const rows  = await getAll(
      'SELECT * FROM lab_orders WHERE patient_id = ? ORDER BY ordered_date DESC LIMIT ?',
      [patId, Math.min(+_count, 100)]
    );
    res.json(toFHIRBundle('searchset', rows.map(lo => toFHIRObservation(lo))));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// ── MedicationRequest ─────────────────────────────────────────────────────────
router.get('/MedicationRequest/:id', async (req, res) => {
  try {
    const m = await getOne('SELECT * FROM medications WHERE medication_id = ?', [req.params.id]);
    if (!m) return fhirError(res, 404, 'not-found', `MedicationRequest/${req.params.id} not found`);
    res.json(toFHIRMedicationRequest(m));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// Search MedicationRequests by patient
router.get('/MedicationRequest', async (req, res) => {
  try {
    const { patient, _count = 20 } = req.query;
    if (!patient) return fhirError(res, 400, 'required', 'patient parameter is required');
    const patId = patient.replace('Patient/', '');
    const rows  = await getAll(
      'SELECT * FROM medications WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?',
      [patId, Math.min(+_count, 100)]
    );
    res.json(toFHIRBundle('searchset', rows.map(m => toFHIRMedicationRequest(m))));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

// ── Appointment ───────────────────────────────────────────────────────────────
router.get('/Appointment/:id', async (req, res) => {
  try {
    const a = await getOne('SELECT * FROM appointments WHERE appointment_id = ?', [req.params.id]);
    if (!a) return fhirError(res, 404, 'not-found', `Appointment/${req.params.id} not found`);
    res.json(toFHIRAppointment(a));
  } catch (err) { fhirError(res, 500, 'exception', err.message); }
});

export default router;