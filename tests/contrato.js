// Suíte de CONTRATO da API de chamados (docs/contratos-api.md) com os
// critérios de aceitação CA1 a CA5 do Desafio 04.
// A mesma suíte roda:
//   - contra o mock do dashboard   (npm test)
//   - contra o backend real        (API_URL=http://localhost:3000/api npm run test:api)
// Se o backend passar, o dashboard funciona com ele sem ajustes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const HORA = 60 * 60 * 1000;
const SLA = { P1: 4, P2: 8, P3: 24, P4: 72 };
const PRIORIDADE = { P1: 'ALTA', P2: 'ALTA', P3: 'MEDIA', P4: 'BAIXA' };

// Pequena pausa para garantir dataAbertura diferentes (CA4 depende da antiguidade)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Mesmo formato enviado pela tela de abertura (publico/js/abertura.js)
function novo(nivelSla = 'P3', sufixo = '') {
  return {
    titulo: `[teste] chamado ${nivelSla} ${sufixo}`.trim(),
    descricao: 'Criado pela suíte de testes automatizados.',
    laboratorio: 'Laboratório Teste',
    categoria: 'Teste',
    prioridade: PRIORIDADE[nivelSla] ?? 'ALTA',
    nivelSla,
  };
}

async function esperaErro(promessa, statusEsperado) {
  await assert.rejects(promessa, (e) => {
    assert.equal(e.status, statusEsperado, `esperava HTTP ${statusEsperado}, veio ${e.status}: ${e.message}`);
    return true;
  });
}

export function executarContrato(nome, fabricaCliente) {
  describe(`Contrato da API — ${nome}`, () => {
    const api = fabricaCliente();

    describe('RF1 / CA5 — abertura de chamado', () => {
      it('cria chamado com status ABERTO e sem técnico', async () => {
        const c = await api.criar(novo('P2'));
        assert.ok(c.id, 'deve devolver id');
        assert.equal(c.status, 'ABERTO');
        assert.equal(c.prioridade, 'ALTA');
        assert.equal(c.nivelSla, 'P2');
        assert.ok(c.tecnicoId == null, 'tecnicoId deve começar vazio');
      });

      it('CA5 — prioridade P7 → 400', async () => {
        await esperaErro(api.criar(novo('P7')), 400);
      });

      it('sem título → 400', async () => {
        await esperaErro(api.criar({ ...novo(), titulo: '' }), 400);
      });

      it('sem laboratório → 400', async () => {
        await esperaErro(api.criar({ ...novo(), laboratorio: '' }), 400);
      });

      it('GET /tickets/:id devolve o chamado criado', async () => {
        const c = await api.criar(novo('P4'));
        assert.equal((await api.buscar(c.id)).titulo, c.titulo);
      });
    });

    describe('RF2 / CA3 — prazo do SLA', () => {
      for (const [n, horas] of Object.entries(SLA)) {
        it(`${n}: prazoSla = dataAbertura + ${horas} h`, async () => {
          const c = await api.criar(novo(n));
          const diff = new Date(c.prazoSla) - new Date(c.dataAbertura);
          assert.ok(Math.abs(diff - horas * HORA) < 1000, `diferença foi ${diff / HORA} h`);
        });
      }
    });

    describe('RF3 / CA4 — fila ordenada', () => {
      it('CA4 — P1 aberto depois de um P3 aparece antes do P3', async () => {
        const p3 = await api.criar(novo('P3', 'CA4'));
        await esperar(20);
        const p1 = await api.criar(novo('P1', 'CA4'));
        const fila = await api.listar();
        const iP1 = fila.findIndex((c) => c.id === p1.id);
        const iP3 = fila.findIndex((c) => c.id === p3.id);
        assert.ok(iP1 >= 0 && iP3 >= 0, 'os dois chamados devem estar na fila');
        assert.ok(iP1 < iP3, `P1 (posição ${iP1}) deveria vir antes do P3 (posição ${iP3})`);
      });

      it('mesmo nível: o mais antigo vem primeiro', async () => {
        const antigo = await api.criar(novo('P2', 'antigo'));
        await esperar(20);
        const recente = await api.criar(novo('P2', 'recente'));
        const fila = await api.listar();
        assert.ok(fila.findIndex((c) => c.id === antigo.id) < fila.findIndex((c) => c.id === recente.id));
      });

      it('filtro por status devolve só aquele status', async () => {
        const abertos = await api.listar('ABERTO');
        assert.ok(abertos.length > 0);
        assert.ok(abertos.every((c) => c.status === 'ABERTO'));
      });
    });

    describe('RF4 / CA1 — transições de status', () => {
      it('CA1 — ABERTO → FECHADO direto → 409', async () => {
        const c = await api.criar(novo());
        await esperaErro(api.mudarStatus(c.id, 'FECHADO'), 409);
      });

      it('ABERTO → RESOLVIDO direto → 409', async () => {
        const c = await api.criar(novo());
        await esperaErro(api.mudarStatus(c.id, 'RESOLVIDO', 'tentativa'), 409);
      });

      it('status fora do contrato → 400', async () => {
        const c = await api.criar(novo());
        await esperaErro(api.mudarStatus(c.id, 'CANCELADO'), 400);
      });

      it('fluxo completo ABERTO → EM_ATENDIMENTO → PENDENTE → EM_ATENDIMENTO → RESOLVIDO → FECHADO', async () => {
        const c = await api.criar(novo('P1'));
        for (const s of ['EM_ATENDIMENTO', 'PENDENTE', 'EM_ATENDIMENTO']) {
          assert.equal((await api.mudarStatus(c.id, s)).status, s);
        }
        assert.equal((await api.mudarStatus(c.id, 'RESOLVIDO', 'Cabo trocado.')).status, 'RESOLVIDO');
        assert.equal((await api.mudarStatus(c.id, 'FECHADO')).status, 'FECHADO');
      });

      it('FECHADO não muda para nenhum status → 409', async () => {
        const c = await api.criar(novo());
        await api.mudarStatus(c.id, 'EM_ATENDIMENTO');
        await api.mudarStatus(c.id, 'RESOLVIDO', 'ok');
        await api.mudarStatus(c.id, 'FECHADO');
        await esperaErro(api.mudarStatus(c.id, 'ABERTO'), 409);
      });

      it('chamado inexistente → 404', async () => {
        await esperaErro(api.mudarStatus(99999999, 'EM_ATENDIMENTO'), 404);
      });
    });

    describe('RF5 / CA2 — solução obrigatória', () => {
      it('CA2 — EM_ATENDIMENTO → RESOLVIDO sem solução → 400', async () => {
        const c = await api.criar(novo());
        await api.mudarStatus(c.id, 'EM_ATENDIMENTO');
        await esperaErro(api.mudarStatus(c.id, 'RESOLVIDO'), 400);
      });

      it('solução só com espaços → 400', async () => {
        const c = await api.criar(novo());
        await api.mudarStatus(c.id, 'EM_ATENDIMENTO');
        await esperaErro(api.mudarStatus(c.id, 'RESOLVIDO', '   '), 400);
      });
    });

    describe('Histórico de alterações', () => {
      it('cada mudança de status gera um registro, o mais recente primeiro', async () => {
        const c = await api.criar(novo());
        await api.mudarStatus(c.id, 'EM_ATENDIMENTO');
        await esperar(10);
        await api.mudarStatus(c.id, 'RESOLVIDO', 'Driver reinstalado.');
        const h = await api.historico(c.id);
        assert.equal(h.length, 2);
        assert.equal(h[0].statusAnterior, 'EM_ATENDIMENTO');
        assert.equal(h[0].statusNovo, 'RESOLVIDO');
        assert.equal(h[0].observacao, 'Driver reinstalado.');
        assert.equal(h[1].statusNovo, 'EM_ATENDIMENTO');
      });

      it('transição recusada não gera histórico', async () => {
        const c = await api.criar(novo());
        await esperaErro(api.mudarStatus(c.id, 'FECHADO'), 409);
        assert.equal((await api.historico(c.id)).length, 0);
      });

      it('histórico de chamado inexistente → 404', async () => {
        await esperaErro(api.historico(99999999), 404);
      });
    });
  });
}
