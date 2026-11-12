const router = require('express').Router();
const controller = require('../controllers/ticketsController');
const operations = require('../controllers/ticketOperationsController');
const { permitir } = require('../middlewares/auth');
// Cada operação delega validação de domínio e acesso ao controlador correspondente.
router.get('/', operations.listar);
router.post('/', operations.criar);
router.get('/:id', operations.buscar);
router.patch('/:id/assign', permitir('TECNICO','ATENDENTE','ADMIN'), operations.atribuir);
router.patch('/:id/status', permitir('TECNICO','ADMIN'), controller.atualizarStatus);
router.get('/:id/history', controller.consultarHistorico);
module.exports = router;
