const statusService = require("../services/statusService");

// Lista de status definidos no contrato da API.
const statusValidos = [
    "ABERTO",
    "EM_ATENDIMENTO",
    "PENDENTE",
    "RESOLVIDO",
    "FECHADO"
];

// Controlador responsável pela alteração de status.
async function atualizarStatus(req, res) {
    try {
        const chamadoId = Number(req.params.id);
        const { status, observacao } = req.body || {};

        // Verifica se o ID é válido.
        if (!Number.isInteger(chamadoId) || chamadoId <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "ID do chamado inválido."
            });
        }

        // Verifica se o novo status foi informado corretamente.
        if (typeof status !== "string" || !status.trim()) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "O novo status é obrigatório."
            });
        }

        const statusNormalizado = status.trim();

        // Verifica se o status existe no contrato da API.
        if (!statusValidos.includes(statusNormalizado)) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Status informado inválido."
            });
        }

        // Verifica se a observação é uma string.
        if (
            observacao !== undefined &&
            observacao !== null &&
            (typeof observacao !== "string" || observacao.length > 2000)
        ) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "A observação deve ser um texto."
            });
        }

        // Verifica se o usuário está autenticado.
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Usuário não autenticado."
            });
        }

        const resultado = await statusService.alterarStatus(
            chamadoId,
            req.user,
            statusNormalizado,
            observacao?.trim() || null
        );

        return res.status(200).json({
            success: true,
            data: resultado,
            message: "Status do chamado atualizado com sucesso."
        });

    } catch (erro) {
        return res.status(erro.statusCode || 500).json({
            success: false,
            data: null,
            message: erro.statusCode
                ? erro.message
                : "Não foi possível atualizar o status do chamado."
        });
    }
}

// Controlador responsável por consultar o histórico de um chamado.
async function consultarHistorico(req, res) {
    try {
        const chamadoId = Number(req.params.id);

        // Verifica se o ID é válido.
        if (!Number.isInteger(chamadoId) || chamadoId <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "ID do chamado inválido."
            });
        }

        // Verifica se o usuário está autenticado.
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Usuário não autenticado."
            });
        }

        const resultado = await statusService.consultarHistorico(chamadoId, req.user);

        return res.status(200).json({
            success: true,
            data: resultado,
            message: "Histórico do chamado consultado com sucesso."
        });

    } catch (erro) {
        return res.status(erro.statusCode || 500).json({
            success: false,
            data: null,
            message: erro.statusCode
                ? erro.message
                : "Não foi possível consultar o histórico do chamado."
        });
    }
}

module.exports = {
    atualizarStatus,
    consultarHistorico
};