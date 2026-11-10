const statusService = require("../services/statusService");

// Controlador responsável pela alteração de status.
async function atualizarStatus(req, res) {
    try {
        const chamadoId = Number(req.params.id);
        const { status, observacao } = req.body;

        // Verifica se o ID é válido.
        if (!Number.isInteger(chamadoId) || chamadoId <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "ID do chamado inválido."
            });
        }

        // Verifica se o novo status foi informado.
        if (!status) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "O novo status é obrigatório."
            });
        }

        // O usuário deverá vir da autenticação.
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Usuário não autenticado."
            });
        }

        const resultado = await statusService.alterarStatus(
            chamadoId,
            req.user.id,
            status,
            observacao || null
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

        const resultado = await statusService.consultarHistorico(chamadoId);

        return res.status(200).json({
            success: true,
            data: resultado,
            message: "Histórico do chamado consultado com sucesso."
        });

    } catch (erro) {
        return res.status(500).json({
            success: false,
            data: null,
            message: "Não foi possível consultar o histórico do chamado."
        });
    }
}

module.exports = {
    atualizarStatus,
    consultarHistorico
};