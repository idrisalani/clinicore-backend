import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../clinicore.db');

console.log(`\n🗄️  SQLite Database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Promise-based query wrapper for sqlite3
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        // SELECT query
        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error('❌ Query error:', err.message);
            console.error('SQL:', sql);
            console.error('Params:', params);
            reject(err);
          } else {
            console.log('✅ Query success:', sql.substring(0, 50), '- Rows:', rows ? rows.length : 0);
            resolve({ rows: rows || [] });
          }
        });
      } else {
        // INSERT, UPDATE, DELETE query
        db.run(sql, params, function(err) {
          if (err) {
            console.error('❌ Query error:', err.message);
            console.error('SQL:', sql);
            console.error('Params:', params);
            reject(err);
          } else {
            console.log('✅ Query success:', sql.substring(0, 50), '- Changes:', this.changes);
            resolve({ 
              rows: [{ changes: this.changes }],
              lastID: this.lastID 
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Query execution error:', error);
      reject(error);
    }
  });
};

export default db;