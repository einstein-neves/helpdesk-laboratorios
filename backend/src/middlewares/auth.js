const pool = require('../config/database');
const { getSupabaseConfig } = require('../config/supabase');
const { fail } = require('../utils/http');
// Valida o JWT no Supabase e associa sua identidade ao perfil local ativo.
async function autenticar(req, res, next) {
 const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
 if (!match) throw fail(401, 'Informe um access token do Supabase.');
 const { url, key } = getSupabaseConfig();
 let response;
 try {
  response = await fetch(url + '/auth/v1/user', {
   headers: { apikey: key, Authorization: 'Bearer ' + match[1] }, signal: AbortSignal.timeout(10000)
  });
 } catch { throw fail(503, 'Autenticacao temporariamente indisponivel.'); }
 if ([401,403].includes(response.status)) throw fail(401, 'Token invalido ou expirado.');
 if (!response.ok) throw fail(503, 'Autenticacao temporariamente indisponivel.');
 const identity = await response.json();
 if (!identity.id || !identity.email || !identity.email_confirmed_at) throw fail(401, 'Confirme seu e-mail para continuar.');
 req.identity = identity;
 const result = await pool.query('SELECT id, auth_user_id, nome, email, perfil, ativo FROM users WHERE auth_user_id = $1', [identity.id]);
 req.user = result.rows[0] || null;
 if (req.user && !req.user.ativo) throw fail(403, 'Usuario desativado.');
 next();
}
function exigirUsuario(req, res, next) {
 if (!req.user) throw fail(403, 'Complete seu cadastro em POST /api/users/me.');
 next();
}
// Mantém autorização por perfil concentrada nas rotas que exigem privilégios.
function permitir(...perfis) {
 return (req, res, next) => {
  if (!req.user || !perfis.includes(req.user.perfil)) throw fail(403, 'Sem permissao para esta operacao.');
  next();
 };
}
module.exports = { autenticar, exigirUsuario, permitir };
