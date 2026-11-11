const readline = require('node:readline/promises');
const pool = require('../config/database');
(async () => {
 const input = readline.createInterface({input:process.stdin,output:process.stdout});
 let client;
 try {
  const email = (process.argv[2] || await input.question('E-mail da conta já confirmada no Supabase Auth: ')).trim().toLowerCase();
  client = await pool.connect(); await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(8123002)');
  if ((await client.query("SELECT 1 FROM public.users WHERE perfil='ADMIN' AND ativo")).rowCount) throw new Error('Já existe administrador ativo. Use a tela de usuários.');
  const result = await client.query('SELECT id,email,email_confirmed_at,raw_user_meta_data FROM auth.users WHERE lower(email)=$1',[email]);
  const identity=result.rows[0];
  if (!identity?.email_confirmed_at) throw new Error('Crie a conta e confirme o e-mail antes de continuar.');
  const nome=String(identity.raw_user_meta_data?.nome || email.split('@')[0]).trim().slice(0,150) || 'Administrador';
  await client.query("INSERT INTO public.users(auth_user_id,nome,email,perfil) VALUES($1,$2,$3,'ADMIN') ON CONFLICT(auth_user_id) DO UPDATE SET perfil='ADMIN',ativo=TRUE,atualizado_em=NOW()",[identity.id,nome,email]);
  await client.query('COMMIT'); console.log('Primeiro administrador configurado. Entre novamente na aplicação.');
 } catch(e) {
  if(client)await client.query('ROLLBACK');
  console.error(e.code ? 'Falha SQL: '+e.code : e.message);process.exitCode=1;
 } finally {input.close();if(client)client.release();await pool.end();}
})();
