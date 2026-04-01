import 'dotenv/config';
import app from './app.js';
import db from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

console.log('\n🔧 Checking CliniCore Database...\n');

try {
  const dbPath = path.join(__dirname, 'database', 'clinicore.db');
  const dbExists = fs.existsSync(dbPath);

  if (!dbExists) {
    console.log('📋 Database not found. Initializing...\n');
    
    // Load and execute init_SIMPLE.js
    const initPath = path.join(__dirname, 'database', 'init_SIMPLE.js');
    
    if (fs.existsSync(initPath)) {
      // Import and run initialization
      const { default: initializeDatabase } = await import('./src/database/init_SIMPLE.js');
      // Note: init_SIMPLE.js handles its own execution
      console.log('✅ Database initialization triggered\n');
    } else {
      console.warn('⚠️  init_SIMPLE.js not found. Database will be created on first run.\n');
    }
  } else {
    console.log('✅ Database found and ready\n');
  }

  // Verify database connection
  db.run('SELECT 1', (err) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    }
  });

  // ==========================================
  // START SERVER
  // ==========================================

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════╗
║   CliniCore Backend API v1.0       ║
║   🏥 Healthcare Management System  ║
╚════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
✅ Database: SQLite (clinicore.db)
✅ Environment: ${process.env.NODE_ENV || 'development'}

📦 LOADED MODULES:
  ✅ Authentication (JWT)
  ✅ User Management
  ✅ Patient Management
  ✅ Appointments (Phase 3)
  ✅ Consultations (Phase 4)
  ✅ Laboratory (Phase 5)
  ✅ Pharmacy (Phase 6)
  ✅ Billing (Phase 7)
  ✅ Admin & RBAC (Phase 10)

🔑 TEST CREDENTIALS:
  Admin:    admin1@clinicore.com
  Doctor:   doctor@clinicore.com
  Patient:  patient1@email.com

📊 API ENDPOINTS:
  Health Check:
    GET /health                       - Server status
    GET /api/v1                       - API info

  Authentication:
    POST /api/v1/auth/register        - Register user
    POST /api/v1/auth/login           - Login user
    POST /api/v1/auth/logout          - Logout user
    POST /api/v1/auth/refresh-token   - Refresh token

  User Management:
    GET  /api/v1/users/me             - Get current user
    GET  /api/v1/users/me/permissions - Get permissions
    PUT  /api/v1/users/me             - Update profile

  Patients:
    GET    /api/v1/patients           - List all patients
    POST   /api/v1/patients           - Create patient
    GET    /api/v1/patients/:id       - Get patient
    PUT    /api/v1/patients/:id       - Update patient

  Appointments:
    GET    /api/v1/appointments       - List appointments
    POST   /api/v1/appointments       - Create appointment
    GET    /api/v1/appointments/:id   - Get appointment
    PUT    /api/v1/appointments/:id   - Update appointment

  Consultations:
    GET    /api/v1/consultations      - List consultations
    POST   /api/v1/consultations      - Create consultation
    GET    /api/v1/consultations/:id  - Get consultation

  Laboratory:
    GET    /api/v1/lab/orders         - List lab orders
    POST   /api/v1/lab/orders         - Create lab order
    GET    /api/v1/lab/results        - Get lab results

  Pharmacy:
    GET    /api/v1/pharmacy/prescriptions  - List prescriptions
    POST   /api/v1/pharmacy/prescriptions  - Create prescription

  Billing:
    GET    /api/v1/billing/invoices   - List invoices
    POST   /api/v1/billing/invoices   - Create invoice
    GET    /api/v1/billing/payments   - List payments

💡 TIP: Use Postman or Thunder Client to test endpoints

⏹️  Press Ctrl+C to stop server
    `);
  });

} catch (error) {
  console.error('❌ Server startup error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}