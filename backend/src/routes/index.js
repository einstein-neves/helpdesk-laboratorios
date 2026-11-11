const router = require('express').Router();
const { autenticar, exigirUsuario } = require('../middlewares/auth');
router.use(autenticar);
router.use('/users', require('./usersRoutes'));
router.get('/auth/me', exigirUsuario, (req,res) => require('../utils/http').ok(res,req.user));
router.use('/tickets', exigirUsuario, require('./ticketsRoutes'));
module.exports = router;
