const express = require("express");
const router = express.Router();

const ticketsController = require("../controllers/ticketsController");

// A rota será protegida pela autenticação.
// O middleware de autenticação será integrado antes de liberar
// o endpoint para uso.

router.patch("/:id/status", (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            data: null,
            message: "Usuário não autenticado."
        });
    }

    next();
}, ticketsController.atualizarStatus);

// Consulta o histórico de alterações de um chamado.
router.get("/:id/history", (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            data: null,
            message: "Usuário não autenticado."
        });
    }

    next();
}, ticketsController.consultarHistorico);

module.exports = router;