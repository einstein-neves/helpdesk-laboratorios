const { Pool } = require("pg");
require("dotenv").config();

// Configuração da conexão com o PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Exporta a conexão para ser utilizada em outras partes do backend
module.exports = pool;