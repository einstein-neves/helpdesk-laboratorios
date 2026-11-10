const statusService = require("./services/statusService");
const pool = require("./config/database");

async function testar() {
    try {
        console.log("Consultando historico do chamado...");

        const historico = await statusService.consultarHistorico(1);

        console.log("\nHistorico encontrado:");
        console.log(historico);

    } catch (erro) {
        console.error("Erro no teste:", erro.message);
    } finally {
        await pool.end();
    }
}

testar();