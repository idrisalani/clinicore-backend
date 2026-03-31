import 'dotenv/config';
import app from './app.js';
import db from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

console.log('\n📋 Initializing Database...');

try {
  // Read and execute schema
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Execute schema statements
  const statements = schema.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      db.exec(statement);
    }
  }
  
  console.log('✅ Database initialized\n');
  
  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════╗
║   CliniCore Backend API v1.0       ║
║   🏥 Healthcare Management System  ║
╚════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
✅ Database: SQLite (clinicore.db)
📊 Environment: ${process.env.NODE_ENV}

Available Endpoints:
  GET  /health                          - Health check
  GET  /api/v1                          - API info
  
  POST /api/v1/auth/register            - Register user
  POST /api/v1/auth/login               - Login user
  POST /api/v1/auth/logout              - Logout user
  POST /api/v1/auth/refresh-token       - Refresh token
  
  GET  /api/v1/users/me                 - Get current user
  GET  /api/v1/users/me/permissions     - Get permissions
  PUT  /api/v1/users/me                 - Update profile

Press Ctrl+C to stop
    `);
  });
} catch (error) {
  console.error('❌ Server startup error:', error.message);
  process.exit(1);
}