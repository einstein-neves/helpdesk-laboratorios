const router = require('express').Router();
const { autenticar, exigirUsuario } = require('../middlewares/auth');
const demo = require('../demo/config');

if (demo.isDemoMode()) {
 // Modo local usa credenciais aleatórias e estado em memória, sem Supabase ou banco.
 router.post('/login', demo.login);
 router.use(demo.authenticate);
 router.use(require('../demo/routes'));
} else {
 // As rotas públicas de entrada usam Supabase; o restante exige perfil confirmado.
 router.use(require('./authRoutes'));
 router.use(autenticar);
 router.use('/users', require('./usersRoutes'));
 router.get('/auth/me', exigirUsuario, (req,res) => require('../utils/http').ok(res,req.user));
 router.use('/tickets', exigirUsuario, require('./ticketsRoutes'));
}
module.exports = router;
