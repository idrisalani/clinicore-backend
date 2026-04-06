// ============================================
// Database Auto-Initialization Wrapper
// File: backend/src/database/autoInit.js
// ============================================
// This file automatically initializes the database
// on server startup if tables are missing.
// Ensures production (Render) has tables ready!

import db from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Check if tables exist in the database
 */
export function checkTablesExist() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      (err, tables) => {
        if (err) reject(err);
        resolve(tables && tables.length > 0);
      }
    );
  });
}

/**
 * Add inventory columns to medication_catalog if they don't exist yet.
 * Safe to run every startup — duplicate column errors are silently ignored.
 */
async function ensureInventoryColumns() {
  const inventoryCols = [
    "ALTER TABLE medication_catalog ADD COLUMN stock_quantity INTEGER DEFAULT 0",
    "ALTER TABLE medication_catalog ADD COLUMN reorder_level INTEGER DEFAULT 10",
    "ALTER TABLE medication_catalog ADD COLUMN expiry_date TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN batch_number TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_name TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_phone TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN supplier_email TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN storage_location TEXT",
    "ALTER TABLE medication_catalog ADD COLUMN last_restocked_at TEXT",
  ];

  for (const sql of inventoryCols) {
    await new Promise((resolve) => {
      db.run(sql, (err) => {
        // "duplicate column name" means it already exists — safe to ignore
        if (err && !err.message.includes('duplicate column')) {
          console.warn('⚠️  Migration warning:', err.message);
        }
        resolve();
      });
    });
  }
  console.log('✅ medication_catalog inventory columns verified');
}

/**
 * Auto-initialize database if needed
 */
export async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization');
    } else {
      console.log('🔧 Database tables not found - initializing...');
      
      // Read and execute init script
      const initScriptPath = path.join(__dirname, 'init_SIMPLE.js');
      
      if (!fs.existsSync(initScriptPath)) {
        throw new Error('init_SIMPLE.js not found at ' + initScriptPath);
      }
      
      // Dynamically import and run init script
      const { initializeDatabase } = await import('./init_SIMPLE.js');
      await initializeDatabase();
      
      console.log('✅ Database auto-initialized successfully!');
    }

    // Always run column migrations — safe whether tables are new or existing
    await ensureInventoryColumns();

    return true;
  } catch (err) {
    console.error('❌ Database auto-initialization failed:', err.message);
    // Don't throw - let server continue but log the error
    return false;
  }
}

/**
 * Initialize database on server startup
 * Call this from server.js before starting the Express server
 */
export async function initDatabaseOnStartup() {
  console.log('🔍 Checking database status...');
  
  try {
    const initialized = await autoInitializeDatabase();
    if (initialized) {
      console.log('✅ Database ready for use');
      return true;
    } else {
      console.log('⚠️  Database check completed with warnings');
      return false;
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    return false;
  }
}