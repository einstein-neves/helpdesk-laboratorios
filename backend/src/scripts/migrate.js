const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
(async () => {
 let client;
 try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(8123001)');
  await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await client.query('ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY');
  await client.query('REVOKE ALL ON public.schema_migrations FROM anon,authenticated');
  const dir = path.resolve(__dirname,'../../database/migrations');
  for (const name of fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()) {
   if ((await client.query('SELECT 1 FROM public.schema_migrations WHERE name=$1',[name])).rowCount) continue;
   await client.query(fs.readFileSync(path.join(dir,name),'utf8'));
   await client.query('INSERT INTO public.schema_migrations(name) VALUES($1)',[name]);
   console.log('Migração aplicada:',name);
  }
  await client.query('COMMIT');
 } catch(e) {
  if (client) await client.query('ROLLBACK');
  console.error('Migração falhou:',e.code || e.name); process.exitCode=1;
 } finally { if(client)client.release(); await pool.end(); }
})();
