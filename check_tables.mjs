import { query } from './src/config/database.js';

const result = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('Tables found:', JSON.stringify(result.rows || result, null, 2));
