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