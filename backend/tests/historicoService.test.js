const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/database");
const { consultarHistorico } = require("../src/services/statusService");

describe("Testes da consulta do histórico", () => {

    it("deve retornar o histórico de um chamado existente", async () => {
        const historicoEsperado = [
            {
                id: 2,
                chamadoId: 1,
                usuarioId: 3,
                statusAnterior: "EM_ATENDIMENTO",
                statusNovo: "RESOLVIDO",
                observacao: "Problema solucionado"
            }
        ];

        const consulta = mock.method(pool, "query", async (sql) => {
            if (sql.includes("FROM tickets")) {
                return { rowCount: 1, rows: [{ id: 1 }] };
            }

            if (sql.includes("FROM ticket_history")) {
                return { rowCount: 1, rows: historicoEsperado };
            }

            throw new Error("Consulta SQL inesperada.");
        });

        try {
            const resultado = await consultarHistorico(1, { id: 3, perfil: "ADMIN" });

            assert.deepEqual(resultado, historicoEsperado);
            assert.equal(consulta.mock.callCount(), 2);
        } finally {
            consulta.mock.restore();
        }
    });

    it("deve retornar uma lista vazia quando o chamado não possui histórico", async () => {
        const consulta = mock.method(pool, "query", async (sql) => {
            if (sql.includes("FROM tickets")) {
                return { rowCount: 1, rows: [{ id: 1 }] };
            }

            if (sql.includes("FROM ticket_history")) {
                return { rowCount: 0, rows: [] };
            }

            throw new Error("Consulta SQL inesperada.");
        });

        try {
            const resultado = await consultarHistorico(1, { id: 3, perfil: "ADMIN" });

            assert.deepEqual(resultado, []);
        } finally {
            consulta.mock.restore();
        }
    });

    it("deve retornar erro 404 quando o chamado não existe", async () => {
        const consulta = mock.method(pool, "query", async () => {
            return { rowCount: 0, rows: [] };
        });

        try {
            await assert.rejects(
                consultarHistorico(999, { id: 3, perfil: "ADMIN" }),
                (erro) => {
                    assert.equal(erro.statusCode, 404);
                    assert.equal(erro.message, "Chamado não encontrado.");
                    return true;
                }
            );

            assert.equal(consulta.mock.callCount(), 1);
        } finally {
            consulta.mock.restore();
        }
    });

});