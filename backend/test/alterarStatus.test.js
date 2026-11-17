const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/database");
const { alterarStatus } = require("../src/services/statusService");

describe("Testes da alteração de status e transações", () => {

    it("deve alterar o status e registrar o histórico com sucesso", async () => {
        const consultas = [];
        let liberada = false;

        const conexao = {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "ABERTO" }]
                    };
                }

                if (sql.includes("UPDATE tickets")) {
                    return {
                        rowCount: 1,
                        rows: [{
                            id: 1,
                            status: "EM_ATENDIMENTO",
                            dataAtualizacao: new Date()
                        }]
                    };
                }

                return { rowCount: 1, rows: [] };
            },

            release() {
                liberada = true;
            }
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            const resultado = await alterarStatus(
                1,
                { id: 3, perfil: "ADMIN" },
                "EM_ATENDIMENTO",
                "Atendimento iniciado"
            );

            assert.equal(resultado.status, "EM_ATENDIMENTO");
            assert.ok(consultas.some(q => q.sql.includes("INSERT INTO ticket_history")));
            assert.ok(consultas.some(q => q.sql.includes("COMMIT")));
            assert.ok(!consultas.some(q => q.sql.includes("ROLLBACK")));
            assert.equal(liberada, true);
        } finally {
            conexaoMock.mock.restore();
        }
    });

    it("deve retornar erro 404 quando o chamado não existir", async () => {
        const consultas = [];
        let liberada = false;

        const conexao = {
            async query(sql) {
                consultas.push(sql);

                if (sql.includes("SELECT id, status")) {
                    return { rowCount: 0, rows: [] };
                }

                return { rowCount: null, rows: [] };
            },

            release() {
                liberada = true;
            }
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            await assert.rejects(
                alterarStatus(999, { id: 3, perfil: "ADMIN" }, "EM_ATENDIMENTO"),
                erro => erro.statusCode === 404
            );

            assert.ok(consultas.includes("ROLLBACK"));
            assert.equal(liberada, true);
        } finally {
            conexaoMock.mock.restore();
        }
    });

    it("deve retornar erro 409 quando a transição não for permitida", async () => {
        const consultas = [];

        const conexao = {
            async query(sql) {
                consultas.push(sql);

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "ABERTO" }]
                    };
                }

                return { rowCount: null, rows: [] };
            },

            release() {}
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            await assert.rejects(
                alterarStatus(1, { id: 3, perfil: "ADMIN" }, "FECHADO"),
                erro => erro.statusCode === 409
            );

            assert.ok(consultas.includes("ROLLBACK"));
            assert.ok(!consultas.some(sql => sql.includes("UPDATE tickets")));
            assert.ok(!consultas.some(sql => sql.includes("INSERT INTO ticket_history")));
        } finally {
            conexaoMock.mock.restore();
        }
    });

    it("deve executar rollback quando ocorrer erro ao registrar o histórico", async () => {
        const consultas = [];

        const conexao = {
            async query(sql) {
                consultas.push(sql);

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "ABERTO" }]
                    };
                }

                if (sql.includes("INSERT INTO ticket_history")) {
                    throw new Error("Falha simulada ao registrar histórico.");
                }

                if (sql.includes("UPDATE tickets")) {
                    return {
                        rowCount: 1,
                        rows: [{
                            id: 1,
                            status: "EM_ATENDIMENTO",
                            dataAtualizacao: new Date()
                        }]
                    };
                }

                return { rowCount: null, rows: [] };
            },

            release() {}
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            await assert.rejects(
                alterarStatus(1, { id: 3, perfil: "ADMIN" }, "EM_ATENDIMENTO"),
                /Falha simulada ao registrar histórico/
            );

            assert.ok(consultas.includes("ROLLBACK"));
            assert.ok(!consultas.includes("COMMIT"));
        } finally {
            conexaoMock.mock.restore();
        }
    });



    it("deve rejeitar a resolução quando a solução não for informada", async () => {
        const consultas = [];
        let liberada = false;

        const conexao = {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "EM_ATENDIMENTO" }]
                    };
                }

                return { rowCount: 1, rows: [] };
            },

            release() {
                liberada = true;
            }
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            await assert.rejects(
                alterarStatus(1, { id: 3, perfil: "ADMIN" }, "RESOLVIDO", null),
                erro => erro.statusCode === 400
                    && erro.message === "A solução aplicada é obrigatória para resolver o chamado."
            );

            assert.ok(consultas.some(q => q.sql.includes("ROLLBACK")));
            assert.ok(!consultas.some(q => q.sql.includes("UPDATE tickets")));
            assert.ok(!consultas.some(q => q.sql.includes("INSERT INTO ticket_history")));
            assert.equal(liberada, true);
        } finally {
            conexaoMock.mock.restore();
        }
    });

        it("deve rejeitar a resolução quando a solução contiver apenas espaços", async () => {
        const consultas = [];

        const conexao = {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "EM_ATENDIMENTO" }]
                    };
                }

                return { rowCount: 1, rows: [] };
            },

            release() {}
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            await assert.rejects(
                alterarStatus(1, { id: 3, perfil: "ADMIN" }, "RESOLVIDO", "   "),
                erro => erro.statusCode === 400
            );

            assert.ok(consultas.some(q => q.sql.includes("ROLLBACK")));
            assert.ok(!consultas.some(q => q.sql.includes("UPDATE tickets")));
            assert.ok(!consultas.some(q => q.sql.includes("INSERT INTO ticket_history")));
        } finally {
            conexaoMock.mock.restore();
        }
    });

        it("deve resolver o chamado e registrar a solução no histórico", async () => {
        const consultas = [];

        const conexao = {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });

                if (sql.includes("SELECT id, status")) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 1, status: "EM_ATENDIMENTO" }]
                    };
                }

                if (sql.includes("UPDATE tickets")) {
                    return {
                        rowCount: 1,
                        rows: [{
                            id: 1,
                            status: "RESOLVIDO",
                            dataAtualizacao: new Date()
                        }]
                    };
                }

                return { rowCount: 1, rows: [] };
            },

            release() {}
        };

        const conexaoMock = mock.method(pool, "connect", async () => conexao);

        try {
            const solucao = "Substituição do cabo de rede.";

            const resultado = await alterarStatus(
                1,
                { id: 3, perfil: "ADMIN" },
                "RESOLVIDO",
                solucao
            );

            const insercaoHistorico = consultas.find(
                q => q.sql.includes("INSERT INTO ticket_history")
            );

            assert.equal(resultado.status, "RESOLVIDO");
            assert.ok(insercaoHistorico);
            assert.equal(insercaoHistorico.parametros[3], "RESOLVIDO");
            assert.equal(insercaoHistorico.parametros[4], solucao);
            assert.ok(consultas.some(q => q.sql.includes("COMMIT")));
            assert.ok(!consultas.some(q => q.sql.includes("ROLLBACK")));
        } finally {
            conexaoMock.mock.restore();
        }
    });
});