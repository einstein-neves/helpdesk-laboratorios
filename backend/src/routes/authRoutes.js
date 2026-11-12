const router = require('express').Router();
const { getSupabaseConfig } = require('../config/supabase');
const { fail, ok, text } = require('../utils/http');

// Encaminha credenciais ao Supabase Auth sem expor chaves administrativas.
async function autenticarNoSupabase(endpoint, payload, mensagemErro) {
 const { url, key } = getSupabaseConfig();
 let response;
 try {
  response = await fetch(url + '/auth/v1/' + endpoint, {
   method: 'POST',
   headers: { apikey: key, 'Content-Type': 'application/json' },
   body: JSON.stringify(payload),
   signal: AbortSignal.timeout(10000)
  });
 } catch {
  throw fail(503, 'Autenticacao temporariamente indisponivel.');
 }

 let result;
 try {
  result = await response.json();
 } catch {
  throw fail(502, 'Resposta invalida do servico de autenticacao.');
 }
 if (!response.ok) {
  throw fail(response.status === 429 ? 429 : response.status >= 500 ? 503 : 400, mensagemErro);
 }
 if (!result.user?.id || !result.user.email) {
  throw fail(502, 'Resposta invalida do servico de autenticacao.');
 }
 return { user: result.user, session: result.session || null };
}

// Cria a identidade no Supabase; o perfil local nasce após a confirmação do e-mail.
router.post('/usuarios', async (req, res) => {
 const nome = text(req.body?.nome, 'Nome', 150);
 const email = text(req.body?.email, 'E-mail', 254).toLowerCase();
 const senha = req.body?.senha;
 if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
  throw fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
 }
 const data = await autenticarNoSupabase('signup', {
  email,
  password: senha,
  data: { nome }
 }, 'Nao foi possivel criar a conta. Verifique os dados e tente novamente.');
 ok(res, data, 201);
});

// Efetua login e devolve a sessão necessária às chamadas autenticadas da API.
router.post('/login', async (req, res) => {
 const email = text(req.body?.email, 'E-mail', 254).toLowerCase();
 const senha = req.body?.senha;
 if (typeof senha !== 'string' || !senha.length || senha.length > 128) {
  throw fail(400, 'Informe uma senha valida.');
 }
 const data = await autenticarNoSupabase('token?grant_type=password', {
  email,
  password: senha
 }, 'Nao foi possivel entrar. Confira e-mail, senha e confirmacao do e-mail.');
 if (!data.session?.access_token || !data.session?.refresh_token) {
  throw fail(502, 'Resposta invalida do servico de autenticacao.');
 }
 ok(res, data);
});

module.exports = router;
