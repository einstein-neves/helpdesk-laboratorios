const router = require('express').Router();
const pool = require('../config/database');
const { exigirUsuario, permitir } = require('../middlewares/auth');
const { PERFIS } = require('../config/permissions');
const { ok, fail, id, text } = require('../utils/http');
// Cria o perfil local a partir da identidade já verificada; perfil não vem do cliente.
router.post('/me', async (req, res) => {
 const nome = text(req.body?.nome, 'Nome', 150);
 if (req.user) return ok(res, req.user);
 const result = await pool.query(
  'INSERT INTO users(auth_user_id,nome,email) VALUES($1,$2,$3) ON CONFLICT(auth_user_id) DO UPDATE SET auth_user_id=EXCLUDED.auth_user_id RETURNING id,nome,email,perfil,ativo',
  [req.identity.id, nome, req.identity.email.trim().toLowerCase()]);
 return ok(res, result.rows[0], 201);
});
router.use(exigirUsuario);
// Endpoints abaixo só operam sobre uma conta local autenticada.
router.get('/technicians', permitir('ATENDENTE','ADMIN'), async (req,res) => {
 const result = await pool.query("SELECT id,nome FROM users WHERE perfil='TECNICO' AND ativo=TRUE ORDER BY nome,id");
 ok(res,result.rows);
});
router.get('/me', (req,res) => ok(res,req.user));
router.get('/', permitir('ADMIN'), async (req,res) => {
 const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
 if (!Number.isSafeInteger(offset) || offset < 0) throw fail(400,'Offset invalido.');
 const result = await pool.query('SELECT id,nome,email,perfil,ativo,criado_em FROM users ORDER BY id LIMIT 50 OFFSET $1',[offset]);
 ok(res,result.rows);
});
router.patch('/:id', permitir('ADMIN'), async (req,res) => {
 const userId = id(req.params.id);
 const {perfil, ativo} = req.body || {};
 if (perfil === undefined && ativo === undefined) throw fail(400,'Informe perfil ou ativo.');
 if (perfil !== undefined && !PERFIS.includes(perfil)) throw fail(400,'Perfil invalido.');
 if (ativo !== undefined && typeof ativo !== 'boolean') throw fail(400,'Ativo deve ser booleano.');
 if (userId === req.user.id && (ativo === false || (perfil !== undefined && perfil !== 'ADMIN')))
  throw fail(409,'Nao e permitido remover seu proprio acesso administrativo.');
 const result = await pool.query('UPDATE users SET perfil=COALESCE($1,perfil),ativo=COALESCE($2,ativo),atualizado_em=NOW() WHERE id=$3 RETURNING id,nome,email,perfil,ativo',[perfil ?? null,ativo ?? null,userId]);
 if (!result.rowCount) throw fail(404,'Usuario nao encontrado.');
 ok(res,result.rows[0]);
});
module.exports = router;
