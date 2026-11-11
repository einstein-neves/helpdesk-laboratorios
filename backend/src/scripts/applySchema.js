const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
(async () => {
 try {
  await pool.query(fs.readFileSync(path.resolve(__dirname,'../../database/schema.sql'),'utf8'));
  console.log('Schema criado com sucesso.');
 } catch(e) {
  console.error('Schema n?o aplicado:', e.code || e.name);
  process.exitCode = 1;
 } finally { await pool.end(); }
})();
