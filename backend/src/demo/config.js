const crypto = require('node:crypto');
const { fail, ok } = require('../utils/http');

const demoToken = crypto.randomBytes(32).toString('base64url');

function isDemoMode() {
 return process.env.DEMO_MODE === 'true';
}

function credentials() {
 if (!isDemoMode()) throw new Error('O modo demo local não está habilitado.');
 if (process.env.NODE_ENV !== 'development') {
  throw new Error('O modo demo só pode ser usado com NODE_ENV=development.');
 }
 const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
 const password = process.env.DEMO_PASSWORD;
 if (!email || !password || password.length < 20) {
  throw new Error('Configure DEMO_EMAIL e uma DEMO_PASSWORD aleatória com pelo menos 20 caracteres.');
 }
 return { email, password };
}

function validateConfiguration() {
 if (isDemoMode()) credentials();
}

function fingerprint(value) {
 return crypto.createHash('sha256').update(String(value)).digest();
}

function sameSecret(actual, expected) {
 return crypto.timingSafeEqual(fingerprint(actual), fingerprint(expected));
}

function getUser() {
 const { email } = credentials();
 return {
  id: 1,
  auth_user_id: 'local-demo-user',
  nome: 'Desenvolvedor',
  email,
  perfil: 'ADMIN',
  ativo: true
 };
}

function getPublicConfig() {
 const { email } = credentials();
 return { mode: 'demo', demoEmail: email };
}

function login(req, res) {
 const { email, password } = credentials();
 const submittedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
 const submittedPassword = typeof req.body?.senha === 'string' ? req.body.senha : '';
 if (!sameSecret(submittedEmail, email) || !sameSecret(submittedPassword, password)) {
  throw fail(401, 'E-mail ou senha inválidos.');
 }

 const user = {
  id: 'local-demo-user',
  email,
  user_metadata: { nome: 'Desenvolvedor' }
 };
 const session = {
  access_token: demoToken,
  refresh_token: demoToken,
  token_type: 'bearer',
  expires_in: 86400,
  user
 };
 return ok(res, { user, session });
}

function authenticate(req, res, next) {
 const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
 if (!match || !sameSecret(match[1], demoToken)) throw fail(401, 'Sessão demo inválida ou expirada.');
 req.identity = { id: 'local-demo-user', email: credentials().email, email_confirmed_at: 'local-demo' };
 req.user = getUser();
 next();
}

function printCredentials() {
 const { email, password } = credentials();
 console.log('Modo demo local: os dados ficam em memória e serão reiniciados ao parar o servidor.');
 console.log('Acesso do desenvolvedor:');
 console.log('  E-mail: ' + email);
 console.log('  Senha: ' + password);
 console.log('  Acesso limitado a http://127.0.0.1');
}

module.exports = {
 isDemoMode,
 validateConfiguration,
 getPublicConfig,
 getUser,
 login,
 authenticate,
 printCredentials
};
