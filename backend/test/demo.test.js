const { test, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.DEMO_MODE = 'true';
process.env.DEMO_EMAIL = 'demo@localhost.test';
process.env.DEMO_PASSWORD = 'test-demo-password-long-enough';

const server = require('../src/app').listen(0, '127.0.0.1');

async function request(path, token, options = {}) {
 if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
 return fetch('http://127.0.0.1:' + server.address().port + '/api' + path, {
  ...options,
  headers: {
   ...(token ? { Authorization: 'Bearer ' + token } : {}),
   ...(options.body ? { 'Content-Type': 'application/json' } : {}),
   ...options.headers
  }
 });
}

after(async () => new Promise(resolve => server.close(resolve)));

test('demo local publica somente o e-mail e exige a senha configurada', async () => {
 const config = await request('/config');
 assert.equal(config.status, 200);
 assert.deepEqual((await config.json()).data, { mode: 'demo', demoEmail: process.env.DEMO_EMAIL });

 const rejected = await request('/login', null, {
  method: 'POST',
  body: JSON.stringify({ email: process.env.DEMO_EMAIL, senha: 'senha-incorreta' })
 });
 assert.equal(rejected.status, 401);

 const login = await request('/login', null, {
  method: 'POST',
  body: JSON.stringify({ email: process.env.DEMO_EMAIL, senha: process.env.DEMO_PASSWORD })
 });
 assert.equal(login.status, 200);
 const session = (await login.json()).data.session;
 assert.ok(session.access_token);
 assert.notEqual(session.access_token, process.env.DEMO_PASSWORD);
 assert.equal((await request('/tickets')).status, 401);
 assert.equal((await request('/users/me', session.access_token)).status, 200);
});

test('demo permite abrir, atribuir, transicionar e consultar histórico', async () => {
 const login = await request('/login', null, {
  method: 'POST',
  body: JSON.stringify({ email: process.env.DEMO_EMAIL, senha: process.env.DEMO_PASSWORD })
 });
 const token = (await login.json()).data.session.access_token;
 const opened = await request('/tickets', token, {
  method: 'POST',
  body: JSON.stringify({
   titulo: 'Chamado de teste local',
   descricao: 'Verificar o fluxo completo de demonstração.',
   laboratorio: 'Laboratório de teste',
   categoria: 'Rede',
   prioridade: 'MEDIA',
   nivelSla: 'P3'
  })
 });
 assert.equal(opened.status, 201);
 const ticket = (await opened.json()).data;
 assert.equal(ticket.status, 'ABERTO');

 const invalidTransition = await request('/tickets/' + ticket.id + '/status', token, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'RESOLVIDO' })
 });
 assert.equal(invalidTransition.status, 409);

 const assignment = await request('/tickets/' + ticket.id + '/assign', token, {
  method: 'PATCH',
  body: JSON.stringify({ tecnicoId: 2 })
 });
 assert.equal(assignment.status, 200);
 assert.equal((await assignment.json()).data.status, 'EM_ATENDIMENTO');

 for (const status of ['PENDENTE', 'EM_ATENDIMENTO', 'RESOLVIDO', 'FECHADO']) {
  const response = await request('/tickets/' + ticket.id + '/status', token, {
   method: 'PATCH',
   body: JSON.stringify({ status, observacao: 'Transição de demonstração.' })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, status);
 }

 const history = await request('/tickets/' + ticket.id + '/history', token);
 assert.equal(history.status, 200);
 assert.equal((await history.json()).data.length, 5);
});

test('modo demo falha fechado fora de development', () => {
 const demo = require('../src/demo/config');
 process.env.NODE_ENV = 'production';
 assert.throws(() => demo.validateConfiguration(), /NODE_ENV=development/);
 process.env.NODE_ENV = 'development';
});
