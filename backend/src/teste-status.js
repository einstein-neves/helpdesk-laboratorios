const statusService = require("./services/statusService");
const pool = require("./config/database");

async function testar() {
    try {
        console.log("Iniciando teste de alteração de status...");

        const resultado = await statusService.alterarStatus(
            1,
            1,
            "EM_ATENDIMENTO",
            "Teste de alteração de status."
        );

        console.log("\nStatus atualizado:");
        console.log(resultado);

        const historico = await statusService.consultarHistorico(1);

        console.log("\nHistórico registrado:");
        console.log(historico);

    } catch (erro) {
        console.error("Erro no teste:", erro.message);
    } finally {
        await pool.end();
    }
}

testar();