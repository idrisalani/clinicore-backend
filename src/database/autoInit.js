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
 * Auto-initialize database if needed
 */
export async function autoInitializeDatabase() {
  try {
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      console.log('✅ Database tables already exist - skipping initialization');
      return true;
    }
    
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