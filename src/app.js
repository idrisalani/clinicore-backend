import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import consultationRoutes from './routes/consultationRoutes.js';
import labRoutes from './routes/labRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import twoFactorRoutes   from './routes/twoFactorRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import barcodeRoutes from './routes/barcodeRoutes.js';
import maternityRoutes from './routes/maternityRoutes.js';
import telemedicineRoutes from './routes/telemedicineRoutes.js';
import symptomCheckerRoutes from './routes/symptomCheckerRoutes.js';
import imagingRoutes from './routes/imagingRoutes.js';
import bedRoutes from './routes/bedRoutes.js';
import supplyChainRoutes from './routes/supplyChainRoutes.js';
import schedulingRoutes from './routes/schedulingRoutes.js';
import fhirRoutes from './routes/fhirRoutes.js';
import icd10Routes from './routes/icd10Routes.js';

const app = express();

// ==========================================
// Middleware
// ==========================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==========================================
// Health Check & Info Endpoints
// ==========================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/v1', (req, res) => {
  res.json({
    message: 'CliniCore Healthcare Management API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      patients: '/api/v1/patients',
      appointments: '/api/v1/appointments',
      consultations: '/api/v1/consultations',
      lab: '/api/v1/lab',
      pharmacy: '/api/v1/pharmacy',
      billing: '/api/v1/billing',
    },
  });
});

// ==========================================
// API Routes
// ==========================================

app.get('/ping', (req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.head('/ping', (req, res) => res.sendStatus(200)); // UptimeRobot sends HEAD

// Admin routes
app.use('/api/v1/admin', adminRoutes);

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// User routes
app.use('/api/v1/users', userRoutes);

// Patient routes
app.use('/api/v1/patients', patientRoutes);

// Appointment routes (PHASE 3)
app.use('/api/v1/appointments', appointmentRoutes);

// Consultation routes (PHASE 4)
app.use('/api/v1/consultations', consultationRoutes);

// Lab routes (PHASE 5)
app.use('/api/v1/lab', labRoutes);

// Pharmacy routes (PHASE 6)
app.use('/api/v1/pharmacy', pharmacyRoutes);

// Billing routes (PHASE 7)
app.use('/api/v1/billing', billingRoutes);

// Queue routes
app.use('/api/v1/queue', queueRoutes);

//PDF routes
app.use('/api/v1/pdf', pdfRoutes);

// Inside app setup:
app.use('/api/v1/auth/2fa',       twoFactorRoutes);
app.use('/api/v1/notifications',  notificationRoutes);

//Barcode routes
app.use('/api/v1/barcode', barcodeRoutes);

//Maternity routes
app.use('/api/v1/maternity', maternityRoutes);

//Telemedicine
app.use('/api/v1/telemedicine', telemedicineRoutes);

//Symptom Checker routes
app.use('/api/v1/symptom-checker', symptomCheckerRoutes);

//Medical Imaging routes
app.use('/api/v1/imaging', imagingRoutes);

//Bed Management routes
app.use('/api/v1/beds', bedRoutes);

//Supply Chain routes
app.use('/api/v1/supply-chain', supplyChainRoutes);

//Staff scheduling routes
app.use('/api/v1/scheduling', schedulingRoutes);

//FHIR routes
app.use('/api/v1/fhir', fhirRoutes);

//ICD 10 routes
app.use('/api/v1/icd10', icd10Routes);

// ==========================================
// Error Handling Middleware
// ==========================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);

  if (err.status === 404) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;