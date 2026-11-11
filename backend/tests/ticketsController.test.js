
const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");

const statusService = require("../src/services/statusService");
const {
    atualizarStatus,
    consultarHistorico
} = require("../src/controllers/ticketsController");

// Simula uma resposta do Express.
function criarResposta() {
    return {
        statusCode: null,
        dados: null,

        status(codigo) {
            this.statusCode = codigo;
            return this;
        },

        json(conteudo) {
            this.dados = conteudo;
            return this;
        }
    };
}

describe("Testes do controller de chamados", () => {

    it("deve atualizar o status com sucesso", async () => {
        const serviceMock = mock.method(
            statusService,
            "alterarStatus",
            async () => ({
                id: 1,
                status: "EM_ATENDIMENTO"
            })
        );

        try {
            const req = {
                params: { id: "1" },
                body: {
                    status: "EM_ATENDIMENTO",
                    observacao: "Atendimento iniciado"
                },
                user: { id: 3 }
            };

            const res = criarResposta();

            await atualizarStatus(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.dados.success, true);
            assert.equal(res.dados.data.status, "EM_ATENDIMENTO");
        } finally {
            serviceMock.mock.restore();
        }
    });

    it("deve rejeitar um ID inválido", async () => {
        const req = {
            params: { id: "abc" },
            body: { status: "EM_ATENDIMENTO" },
            user: { id: 3 }
        };

        const res = criarResposta();

        await atualizarStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.dados.success, false);
        assert.equal(res.dados.message, "ID do chamado inválido.");
    });

    it("deve rejeitar um status inválido", async () => {
        const req = {
            params: { id: "1" },
            body: { status: "CANCELADO" },
            user: { id: 3 }
        };

        const res = criarResposta();

        await atualizarStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.dados.success, false);
        assert.equal(res.dados.message, "Status informado inválido.");
    });

    it("deve rejeitar uma atualização sem usuário autenticado", async () => {
        const req = {
            params: { id: "1" },
            body: { status: "EM_ATENDIMENTO" }
        };

        const res = criarResposta();

        await atualizarStatus(req, res);

        assert.equal(res.statusCode, 401);
        assert.equal(res.dados.success, false);
    });

    it("deve retornar 404 quando o chamado não existir", async () => {
        const serviceMock = mock.method(
            statusService,
            "alterarStatus",
            async () => {
                const erro = new Error("Chamado não encontrado.");
                erro.statusCode = 404;
                throw erro;
            }
        );

        try {
            const req = {
                params: { id: "999" },
                body: { status: "EM_ATENDIMENTO" },
                user: { id: 3 }
            };

            const res = criarResposta();

            await atualizarStatus(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(res.dados.message, "Chamado não encontrado.");
        } finally {
            serviceMock.mock.restore();
        }
    });

    it("deve consultar o histórico com sucesso", async () => {
        const serviceMock = mock.method(
            statusService,
            "consultarHistorico",
            async () => ([
                {
                    id: 1,
                    chamadoId: 1,
                    statusAnterior: "ABERTO",
                    statusNovo: "EM_ATENDIMENTO"
                }
            ])
        );

        try {
            const req = {
                params: { id: "1" },
                user: { id: 3 }
            };

            const res = criarResposta();

            await consultarHistorico(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.dados.success, true);
            assert.equal(res.dados.data.length, 1);
        } finally {
            serviceMock.mock.restore();
        }
    });

    it("deve retornar 500 quando ocorrer um erro interno", async () => {
        const serviceMock = mock.method(
            statusService,
            "alterarStatus",
            async () => {
                throw new Error("Erro interno simulado.");
            }
        );

        try {
            const req = {
                params: { id: "1" },
                body: { status: "EM_ATENDIMENTO" },
                user: { id: 3 }
            };

            const res = criarResposta();

            await atualizarStatus(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.dados.success, false);
            assert.equal(
                res.dados.message,
                "Não foi possível atualizar o status do chamado."
            );
        } finally {
            serviceMock.mock.restore();
        }
    });

});
