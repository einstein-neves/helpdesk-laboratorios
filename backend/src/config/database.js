const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const backendDir = path.resolve(__dirname, "../..");
require("dotenv").config({ path: path.join(backendDir, ".env"), quiet: true });

const connectionString = process.env.DATABASE_URL;
let url;
if (connectionString) {
    try {
        url = new URL(connectionString);
        if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    } catch {
        throw new Error("DATABASE_URL deve ser uma URL PostgreSQL válida.");
    }
    // A configuração TLS abaixo prevalece sobre os parâmetros da URL.
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl", "uselibpqcompat"]) {
        url.searchParams.delete(key);
    }
}

const sslEnabled = process.env.DB_SSL === undefined
    ? Boolean(connectionString)
    : process.env.DB_SSL === "true";
if (process.env.DB_SSL !== undefined && !["true", "false"].includes(process.env.DB_SSL)) {
    throw new Error("DB_SSL deve ser true ou false.");
}
const ssl = sslEnabled ? { rejectUnauthorized: true } : false;
if (ssl && process.env.DB_SSL_CA_PATH) {
    ssl.ca = fs.readFileSync(path.resolve(backendDir, process.env.DB_SSL_CA_PATH), "utf8");
}

const pool = new Pool({
    ...(url ? { connectionString: url.toString() } : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    }),
    ssl,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

pool.on("error", (erro) => {
    console.error("Erro em conexão ociosa do PostgreSQL:", erro.code || "CONNECTION_ERROR");
});

// Exporta a conexão para ser utilizada em outras partes do backend
module.exports = pool;
