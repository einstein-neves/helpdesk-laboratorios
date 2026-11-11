// Teste explícito no Supabase configurado: cria contas temporárias sem enviar
// e-mail, testa os fluxos HTTP reais e remove somente os registros criados aqui.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/database');
const { getSupabaseConfig } = require('../config/supabase');
const app = require('../app');
const { url, key } = getSupabaseConfig({ admin: true });
const publicConfig = getSupabaseConfig();
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const authIds = [], userIds = [], ticketIds = [];
const run = randomUUID();
let server;

(async () => {
 try {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, token, method = 'GET', body) {
   const response = await fetch(base + '/api' + path, {
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
   });
   return { status: response.status, body: await response.json() };
  }
  const config = await request('/config');
  assert.equal(config.status, 200);
  assert.deepEqual(Object.keys(config.body.data).sort(), ['publishableKey','url']);
  const accounts = [];
  for (const perfil of ['SOLICITANTE','SOLICITANTE','TECNICO','ATENDENTE','ADMIN']) {
   const email = 'hd-' + run + '-' + accounts.length + '@example.com';
   const password = randomBytes(24).toString('base64url');
   const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
   if (created.error) throw new Error('Criação de conta temporária falhou: ' + created.error.status);
   authIds.push(created.data.user.id);
   const client = createClient(publicConfig.url, publicConfig.key, { auth: { persistSession: false, autoRefreshToken: false } });
   const login = await client.auth.signInWithPassword({ email, password });
   assert.equal(login.error, null);
   const token = login.data.session.access_token;
   const profile = await request('/users/me', token, 'POST', { nome: 'Teste integração ' + perfil, perfil: 'ADMIN' });
   assert.equal(profile.status, 201);
   userIds.push(profile.body.data.id);
   assert.equal(profile.body.data.perfil, 'SOLICITANTE');
   await pool.query('UPDATE users SET perfil=$1 WHERE id=$2', [perfil, profile.body.data.id]);
   accounts.push({ token, id: profile.body.data.id, client, refreshToken: login.data.session.refresh_token });
  }
  console.log('OK: login real e cadastro sem escalada de perfil.');
  const [solicitante, outro, tecnico, atendente, administrador] = accounts;
  const create = await request('/tickets', solicitante.token, 'POST', {
   titulo: 'Integração temporária ' + run, descricao: 'Registro temporário removido ao final.', laboratorio: 'Teste',
   categoria: 'Software', prioridade: 'ALTA', nivelSla: 'P1', solicitanteId: outro.id,
   prazoSla: '2000-01-01T00:00:00Z'
  });
  if (create.body.data?.id) ticketIds.push(create.body.data.id);
  assert.equal(create.status, 201);
  const ticket = create.body.data;
  assert.equal(ticket.solicitanteId, solicitante.id);
  assert.equal(Math.round((new Date(ticket.prazoSla) - new Date(ticket.dataAbertura)) / 3600000), 4);
  assert.equal((await request('/tickets/' + ticket.id, outro.token)).status, 404);
  assert.equal((await request('/tickets/' + ticket.id + '/history', outro.token)).status, 404);
  assert.equal((await request('/tickets/' + ticket.id + '/status', solicitante.token, 'PATCH', { status: 'RESOLVIDO' })).status, 403);
  assert.equal((await request('/users', solicitante.token)).status, 403);
  assert.equal((await request('/tickets')).status, 401);
  console.log('OK: criação, SLA no servidor e bloqueio de acesso a chamados alheios.');
  const assign = await request('/tickets/' + ticket.id + '/assign', atendente.token, 'PATCH', { tecnicoId: tecnico.id });
  assert.equal(assign.status, 200);
  assert.equal(assign.body.data.status, 'EM_ATENDIMENTO');
  assert.equal((await request('/tickets/' + ticket.id + '/assign', tecnico.token, 'PATCH', { tecnicoId: tecnico.id })).status, 409);
  assert.equal((await request('/tickets/' + ticket.id + '/status', atendente.token, 'PATCH', { status: 'RESOLVIDO' })).status, 403);
  const update = await request('/tickets/' + ticket.id + '/status', tecnico.token, 'PATCH', { status: 'RESOLVIDO', observacao: 'Teste de resolução' });
  assert.equal(update.status, 200);
  const history = await request('/tickets/' + ticket.id + '/history', solicitante.token);
  assert.equal(history.status, 200);
  assert.equal(history.body.data.length, 2);
  console.log('OK: atribuição, transição e histórico transacionais.');
  assert.equal((await request('/users/' + outro.id, administrador.token, 'PATCH', { ativo: false })).status, 200);
  assert.equal((await request('/tickets', outro.token)).status, 403);
  assert.equal((await request('/users/' + administrador.id, administrador.token, 'PATCH', { perfil: 'SOLICITANTE' })).status, 409);
  assert.equal((await request('/users/' + tecnico.id, administrador.token, 'PATCH', { perfil: 'SOLICITANTE' })).status, 200);
  assert.equal((await request('/tickets/' + ticket.id + '/status', tecnico.token, 'PATCH', { status: 'FECHADO' })).status, 403);
  console.log('OK: administração, desativação e mudança de perfil com token já emitido.');
  const refreshed = await solicitante.client.auth.refreshSession({ refresh_token: solicitante.refreshToken });
  assert.equal(refreshed.error, null);
  assert.equal((await request('/users/me', refreshed.data.session.access_token)).status, 200);
  const signout = await solicitante.client.auth.signOut({ scope: 'local' });
  assert.equal(signout.error, null);
  assert.equal((await solicitante.client.auth.getSession()).data.session, null);
  console.log('OK: renovação de sessão e logout reais.');
 } catch (error) {
  // Não imprimir objetos do SDK: podem conter credenciais ou tokens.
  console.error('Integração falhou:', error.code || error.name);
  console.error('Causa:', error.cause?.code || 'sem código');
  console.error((error.stack || '').split('\n').filter(line => line.includes('verifyIntegration.js')).join('\n'));
  if (error.name === 'AssertionError') console.error('Esperado:', error.expected, 'Recebido:', error.actual);
  process.exitCode = 1;
 } finally {
  try {
   await pool.query('DELETE FROM ticket_history WHERE chamado_id=ANY($1::int[])', [ticketIds]);
   await pool.query('DELETE FROM tickets WHERE id=ANY($1::int[])', [ticketIds]);
   await pool.query('DELETE FROM users WHERE id=ANY($1::int[])', [userIds]);
   for (const id of authIds) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Limpeza Auth incompleta.');
   }
   console.log('Contas e registros temporários removidos.');
  } catch (error) { console.error('Falha na limpeza:',error.code || error.name);process.exitCode=1; }
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
 }
})();
