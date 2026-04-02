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
// DATABASE AUTO-INITIALIZATION FUNCTION
// ==========================================

/**
 * Check if database tables exist
 */
function checkTablesExist() {
  return new Promise((resolve) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      (err, tables) => {
        if (err) {
          console.error('Error checking tables:', err.message);
          resolve(false);
        } else {
          resolve(tables && tables.length > 0);
        }
      }
    );
  });
}

/**
 * Auto-initialize database if tables are missing
 * Prevents init script from calling process.exit()
 */
async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization\n');
      return true;
    }
    
    console.log('🔧 Database tables not found - auto-initializing...\n');
    
    const initPath = path.join(__dirname, 'database', 'init_PROPER.js');
    
    if (!fs.existsSync(initPath)) {
      console.warn('⚠️  init_PROPER.js not found at:', initPath);
      console.warn('   Continuing with server startup...\n');
      return false;
    }

    try {
      console.log('📋 Loading init_PROPER.js...');
      
      // CRITICAL: Prevent process.exit() call from init script
      const originalExit = process.exit;
      process.exit = (code) => {
        console.log('ℹ️  Init script attempted to exit (suppressed - server continuing)');
        return undefined;
      };
      
      try {
        // Import the init module - this will auto-run on import
        const initModule = await import('./database/init_PROPER.js');
        console.log('✅ init_PROPER.js executed successfully\n');
        
        // Also try to call exported function if it exists
        if (initModule.initializeDatabase && typeof initModule.initializeDatabase === 'function') {
          console.log('🔄 Running initializeDatabase function...');
          await initModule.initializeDatabase();
        }
        
        // Small delay to ensure all writes complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        console.log('✅ Database auto-initialization complete!\n');
        return true;
      } finally {
        // Restore original process.exit
        process.exit = originalExit;
      }
    } catch (initErr) {
      // Restore process.exit in case of error
      process.exit = process.exit;
      
      console.error('❌ Error during initialization:', initErr.message);
      if (initErr.stack) {
        console.error('Stack:', initErr.stack);
      }
      console.log('⚠️  Database may not be fully initialized, but server will continue...\n');
      return false;
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    console.log('⚠️  Continuing with server startup...\n');
    return false;
  }
}

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

console.log('\n🗄️  SQLite Database: ' + path.join(__dirname, '../../clinicore.db') + '\n');
console.log('🔧 Checking CliniCore Database...\n');

try {
  const dbPath = path.join(__dirname, '../../clinicore.db');
  const dbExists = fs.existsSync(dbPath);

  if (!dbExists) {
    console.log('📋 Database file not found. Will be created during initialization.\n');
  } else {
    console.log('✅ Database file found\n');
  }

  // Check if tables exist and auto-initialize if needed
  await autoInitializeDatabase();

  // Verify database connection
  const dbReady = await new Promise((resolve) => {
    db.run('SELECT 1', (err) => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
        resolve(false);
      } else {
        console.log('✅ Database connection verified');
        resolve(true);
      }
    });
  });

  if (!dbReady) {
    console.error('❌ Cannot proceed - database not accessible');
    process.exit(1);
  }

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
  Password: SecurePass123

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
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
}