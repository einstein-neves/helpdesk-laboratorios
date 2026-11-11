const pool = require("../config/database");

// Define quais transições de status são permitidas.
const transicoesPermitidas = {
    ABERTO: ["EM_ATENDIMENTO"],
    EM_ATENDIMENTO: ["PENDENTE", "RESOLVIDO"],
    PENDENTE: ["EM_ATENDIMENTO", "RESOLVIDO"],
    RESOLVIDO: ["FECHADO"],
    FECHADO: []
};

// Função responsável por alterar o status e registrar o histórico.

async function alterarStatus(chamadoId, usuarioId, statusNovo, observacao = null) {
    const conexao = await pool.connect();
    let transacaoIniciada = false;

    try {
        await conexao.query("BEGIN");
        transacaoIniciada = true;

        // Busca o chamado e bloqueia sua linha durante a operação.
        const resultado = await conexao.query(
            `SELECT id, status
             FROM tickets
             WHERE id = $1
             FOR UPDATE`,
            [chamadoId]
        );

        if (resultado.rowCount === 0) {
            const erro = new Error("Chamado não encontrado.");
            erro.statusCode = 404;
            throw erro;
        }

        const chamado = resultado.rows[0];
        const statusAnterior = chamado.status;

        // Verifica se a transição é permitida.
        if (!transicoesPermitidas[statusAnterior]?.includes(statusNovo)) {
            const erro = new Error(
                `Não é permitido alterar o status de ${statusAnterior} para ${statusNovo}.`
            );
            erro.statusCode = 409;
            throw erro;
        }

        // Atualiza o status do chamado.
        const atualizacao = await conexao.query(
            `UPDATE tickets
             SET status = $1,
                 data_atualizacao = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, status, data_atualizacao AS "dataAtualizacao"`,
            [statusNovo, chamadoId]
        );

        // Registra a alteração no histórico.
        await conexao.query(
            `INSERT INTO ticket_history
             (chamado_id, usuario_id, status_anterior, status_novo, observacao)
             VALUES ($1, $2, $3, $4, $5)`,
            [chamadoId, usuarioId, statusAnterior, statusNovo, observacao]
        );

        await conexao.query("COMMIT");
        transacaoIniciada = false;

        return atualizacao.rows[0];

    } catch (erro) {
        if (transacaoIniciada) {
            try {
                await conexao.query("ROLLBACK");
            } catch (erroRollback) {
                console.error("Erro ao executar ROLLBACK:", erroRollback);
            }
        }

        throw erro;

    } finally {
        conexao.release();
    }
}


// Consulta o histórico de alterações de um chamado.
async function consultarHistorico(chamadoId) {
    // Primeiro verifica se o chamado existe.
    const chamado = await pool.query(
        `SELECT id
         FROM tickets
         WHERE id = $1`,
        [chamadoId]
    );

    if (chamado.rowCount === 0) {
        const erro = new Error("Chamado não encontrado.");
        erro.statusCode = 404;
        throw erro;
    }

    // Consulta o histórico de alterações do chamado.
    const resultado = await pool.query(
        `SELECT
            h.id,
            h.chamado_id AS "chamadoId",
            h.usuario_id AS "usuarioId",
            h.status_anterior AS "statusAnterior",
            h.status_novo AS "statusNovo",
            h.observacao,
            h.data_alteracao AS "dataAlteracao"
         FROM ticket_history h
         WHERE h.chamado_id = $1
         ORDER BY h.data_alteracao DESC`,
        [chamadoId]
    );

    return resultado.rows;
}

module.exports = {
    alterarStatus,
    consultarHistorico
};