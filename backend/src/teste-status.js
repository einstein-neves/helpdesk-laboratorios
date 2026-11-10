const statusService = require("./services/statusService");
const pool = require("./config/database");

async function testar() {
    try {
        console.log("Testando FECHADO para EM_ATENDIMENTO...");

        await statusService.alterarStatus(
            1,
            1,
            "EM_ATENDIMENTO",
            "Teste de tentativa de reabrir chamado fechado."
        );

        console.log("ATENCAO: a transicao foi aceita, mas deveria ser bloqueada.");

    } catch (erro) {
        console.log("\nResultado esperado: transicao bloqueada.");
        console.log("Mensagem:", erro.message);
        console.log("Código:", erro.statusCode || 500);

        const historico = await statusService.consultarHistorico(1);

        console.log("\nHistorico apos a tentativa:");
        console.log(historico);

    } finally {
        await pool.end();
    }
}

testar();