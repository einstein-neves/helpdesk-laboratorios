const app = require("./server");
const pool = require("./config/database");
const demo = require("./demo/config");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT deve ser um número entre 1 e 65535.");
}

const host = demo.isDemoMode() ? "127.0.0.1" : process.env.HOST;
const address = host ? `http://${host}:${port}` : `http://localhost:${port}`;
const onListening = () => {
    console.log(`Servidor Help Desk iniciado em ${address}`);
    if (demo.isDemoMode()) demo.printCredentials();
};
const server = host ? app.listen(port, host, onListening) : app.listen(port, onListening);

server.on("error", (error) => {
    console.error("Servidor HTTP não iniciado:", error.code || error.name);
    process.exitCode = 1;
    pool.end();
});

function shutdown() {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
