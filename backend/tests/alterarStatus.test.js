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
                3,
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
                alterarStatus(999, 3, "EM_ATENDIMENTO"),
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
                alterarStatus(1, 3, "FECHADO"),
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
                alterarStatus(1, 3, "EM_ATENDIMENTO"),
                /Falha simulada ao registrar histórico/
            );

            assert.ok(consultas.includes("ROLLBACK"));
            assert.ok(!consultas.includes("COMMIT"));
        } finally {
            conexaoMock.mock.restore();
        }
    });

});