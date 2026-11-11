const pool = require("./config/database");

async function testarConexao() {
    try {
        const resultado = await pool.query("SELECT NOW()");

        console.log("Conexão com PostgreSQL realizada com sucesso!");
        console.log("Data e hora do banco:", resultado.rows[0].now);
    } catch (erro) {
        console.error("Erro ao conectar ao PostgreSQL:");
        console.error(erro.code || "Falha de conexão. Verifique as variáveis e o certificado TLS.");
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

testarConexao();
