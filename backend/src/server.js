const express = require("express");
const cors = require("cors");
require("dotenv").config();

const ticketsRoutes = require("./routes/ticketsRoutes");

const app = express();

// Middlewares gerais
app.use(cors());
app.use(express.json());

// Rota inicial para verificar se o servidor está funcionando.
app.get("/", (req, res) => {
    res.json({
        success: true,
        data: null,
        message: "API Help Desk funcionando."
    });
});

// Rotas dos chamados
app.use("/api/tickets", ticketsRoutes);

// Inicialização do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});