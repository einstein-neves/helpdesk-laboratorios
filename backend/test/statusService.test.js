const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { podeTransicionar } = require("../src/services/statusService");

describe("Testes das transições de status", () => {

    it("deve permitir ABERTO para EM_ATENDIMENTO", () => {
        assert.equal(podeTransicionar("ABERTO", "EM_ATENDIMENTO"), true);
    });

    it("deve permitir EM_ATENDIMENTO para PENDENTE", () => {
        assert.equal(podeTransicionar("EM_ATENDIMENTO", "PENDENTE"), true);
    });

    it("deve permitir EM_ATENDIMENTO para RESOLVIDO", () => {
        assert.equal(podeTransicionar("EM_ATENDIMENTO", "RESOLVIDO"), true);
    });

    it("deve permitir PENDENTE para EM_ATENDIMENTO", () => {
        assert.equal(podeTransicionar("PENDENTE", "EM_ATENDIMENTO"), true);
    });

    it("deve permitir PENDENTE para RESOLVIDO", () => {
        assert.equal(podeTransicionar("PENDENTE", "RESOLVIDO"), true);
    });

    it("deve permitir RESOLVIDO para FECHADO", () => {
        assert.equal(podeTransicionar("RESOLVIDO", "FECHADO"), true);
    });

    it("deve impedir ABERTO para RESOLVIDO", () => {
        assert.equal(podeTransicionar("ABERTO", "RESOLVIDO"), false);
    });

    it("deve impedir RESOLVIDO para EM_ATENDIMENTO", () => {
        assert.equal(podeTransicionar("RESOLVIDO", "EM_ATENDIMENTO"), false);
    });

    it("deve impedir qualquer alteração após FECHADO", () => {
        assert.equal(podeTransicionar("FECHADO", "ABERTO"), false);
    });

    it("deve rejeitar um status inexistente", () => {
        assert.equal(podeTransicionar("ABERTO", "CANCELADO"), false);
    });

});