const express = require('express');
const cors = require('cors');
require('dotenv').config();

// criado em 10/11/2026 E.N
// Importando rotas ou controladores criados pela equipe (ajuste conforme necessário)
// const ticketsController = require('./controllers/ticketsController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste inicial
app.get('/', (req, res) => {
  res.json({ mensagem: 'API do Help Desk - Laboratórios rodando com sucesso! 🚀' });
});

// Exemplo de rota de chamados (integração futura com o controller)
// app.use('/api/tickets', ticketsController);

// Inicializar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});