import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Open existing database
const dbPath = path.join(__dirname, '../backend/clinicore.db');
console.log(`\n📊 Debugging Database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Cannot open database:', err.message);
    process.exit(1);
  }
  console.log('✅ Database opened\n');
  runDebug();
});

function runDebug() {
  // 1. Check if tables exist
  console.log('📋 CHECKING TABLES:\n');
  db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    (err, tables) => {
      if (err) {
        console.error('❌ Error querying tables:', err.message);
      } else {
        console.log(`Found ${tables.length} tables:\n`);
        tables.forEach(t => console.log(`  ✅ ${t.name}`));
      }
      
      // 2. Check roles table structure
      console.log('\n\n📊 ROLES TABLE SCHEMA:\n');
      db.all("PRAGMA table_info(roles)", (err, cols) => {
        if (err) {
          console.error('❌ Error:', err.message);
        } else if (!cols || cols.length === 0) {
          console.error('❌ roles table does NOT exist!');
        } else {
          console.log('Columns:');
          cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
        }
        
        // 3. Check permissions table structure
        console.log('\n\n📊 PERMISSIONS TABLE SCHEMA:\n');
        db.all("PRAGMA table_info(permissions)", (err, cols) => {
          if (err) {
            console.error('❌ Error:', err.message);
          } else if (!cols || cols.length === 0) {
            console.error('❌ permissions table does NOT exist!');
          } else {
            console.log('Columns:');
            cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
          }
          
          // 4. Check role_permissions table structure
          console.log('\n\n📊 ROLE_PERMISSIONS TABLE SCHEMA:\n');
          db.all("PRAGMA table_info(role_permissions)", (err, cols) => {
            if (err) {
              console.error('❌ Error:', err.message);
            } else if (!cols || cols.length === 0) {
              console.error('❌ role_permissions table does NOT exist!');
            } else {
              console.log('Columns:');
              cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
            }
            
            // 5. Count rows in each table
            console.log('\n\n📊 DATA IN TABLES:\n');
            
            db.get('SELECT COUNT(*) as count FROM roles', (err, row) => {
              console.log(`roles: ${row ? row.count : 0} rows`);
              
              db.get('SELECT COUNT(*) as count FROM permissions', (err, row) => {
                console.log(`permissions: ${row ? row.count : 0} rows`);
                
                db.get('SELECT COUNT(*) as count FROM role_permissions', (err, row) => {
                  console.log(`role_permissions: ${row ? row.count : 0} rows\n`);
                  
                  // 6. Try to run the problematic query
                  console.log('\n\n🔧 TESTING PROBLEMATIC QUERY:\n');
                  console.log('Running: SELECT 1, permission_id FROM permissions\n');
                  
                  db.all('SELECT 1, permission_id FROM permissions', (err, rows) => {
                    if (err) {
                      console.error('❌ Error:', err.message);
                      console.error('Code:', err.code);
                    } else {
                      console.log(`✅ Query succeeded, found ${rows.length} rows`);
                      if (rows.length > 0) {
                        console.log('First row:', rows[0]);
                      }
                    }
                    
                    console.log('\n\n🔧 TESTING INSERT INTO role_permissions:\n');
                    console.log('Running: INSERT INTO role_permissions (role_id, permission_id) SELECT 1, permission_id FROM permissions\n');
                    
                    db.run(
                      'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 1, permission_id FROM permissions',
                      function(err) {
                        if (err) {
                          console.error('❌ Error:', err.message);
                          console.error('Code:', err.code);
                          console.error('Full error:', err);
                        } else {
                          console.log(`✅ Insert succeeded, changes: ${this.changes}`);
                        }
                        
                        db.close();
                        console.log('\n\n✅ Debug complete\n');
                        process.exit(err ? 1 : 0);
                      }
                    );
                  });
                });
              });
            });
          });
        });
      });
    }
  );
}