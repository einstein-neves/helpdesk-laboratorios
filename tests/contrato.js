// Suíte de CONTRATO da API de chamados — critérios de aceitação CA1 a CA5 + RF4/RF5.
// A mesma suíte roda:
//   - contra o mock da interface   (npm test)
//   - contra o backend real         (API_URL=http://localhost:3000/api npm run test:api)
// Assim, se o backend passar, a interface funciona com ele sem ajustes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const HORA = 60 * 60 * 1000;
const SLA = { P1: 4, P2: 8, P3: 24, P4: 72 };

// Pequena pausa para garantir aberto_em diferentes (CA4 depende da antiguidade)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function base(prioridade = 'P3', sufixo = '') {
  return {
    titulo: `[teste] chamado ${prioridade} ${sufixo}`.trim(),
    descricao: 'Criado pela suíte de testes automatizados.',
    laboratorio: 'Lab Teste',
    prioridade,
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
      it('cria chamado válido com status "aberto" e sem solução', async () => {
        const c = await api.criar(base('P2'));
        assert.ok(c.id, 'deve devolver id');
        assert.equal(c.status, 'aberto');
        assert.equal(c.prioridade, 'P2');
        assert.ok(!c.solucao, 'solução deve começar vazia');
        assert.ok(!c.resolvido_em, 'resolvido_em deve começar vazio');
      });

      it('CA5 — prioridade P7 → 400', async () => {
        await esperaErro(api.criar(base('P7')), 400);
      });

      it('sem título → 400', async () => {
        await esperaErro(api.criar({ ...base(), titulo: '' }), 400);
      });

      it('sem laboratório → 400', async () => {
        await esperaErro(api.criar({ ...base(), laboratorio: '' }), 400);
      });
    });

    describe('RF2 / CA3 — prazo do SLA', () => {
      for (const [p, horas] of Object.entries(SLA)) {
        it(`${p}: prazo_sla = aberto_em + ${horas} h`, async () => {
          const c = await api.criar(base(p));
          const diff = new Date(c.prazo_sla) - new Date(c.aberto_em);
          assert.equal(diff, horas * HORA);
        });
      }
    });

    describe('RF3 / CA4 — fila ordenada', () => {
      it('CA4 — P1 aberto depois de um P3 aparece antes do P3', async () => {
        const p3 = await api.criar(base('P3', 'CA4'));
        await esperar(20);
        const p1 = await api.criar(base('P1', 'CA4'));
        const fila = await api.listar();
        const iP1 = fila.findIndex((c) => c.id === p1.id);
        const iP3 = fila.findIndex((c) => c.id === p3.id);
        assert.ok(iP1 >= 0 && iP3 >= 0, 'os dois chamados devem estar na fila');
        assert.ok(iP1 < iP3, `P1 (posição ${iP1}) deveria vir antes do P3 (posição ${iP3})`);
      });

      it('mesma prioridade: o mais antigo vem primeiro', async () => {
        const antigo = await api.criar(base('P2', 'antigo'));
        await esperar(20);
        const recente = await api.criar(base('P2', 'recente'));
        const fila = await api.listar();
        assert.ok(fila.findIndex((c) => c.id === antigo.id) < fila.findIndex((c) => c.id === recente.id));
      });

      it('fila inteira respeita prioridade e antiguidade', async () => {
        const fila = await api.listar();
        for (let i = 1; i < fila.length; i++) {
          const a = fila[i - 1]; const b = fila[i];
          const ok = a.prioridade < b.prioridade
            || (a.prioridade === b.prioridade && new Date(a.aberto_em) <= new Date(b.aberto_em));
          assert.ok(ok, `fora de ordem: #${a.id} (${a.prioridade}) antes de #${b.id} (${b.prioridade})`);
        }
      });

      it('filtro por status devolve só aquele status', async () => {
        const abertos = await api.listar('aberto');
        assert.ok(abertos.length > 0);
        assert.ok(abertos.every((c) => c.status === 'aberto'));
      });
    });

    describe('RF4 / CA1 — transições de status', () => {
      it('CA1 — aberto → fechado direto → 409', async () => {
        const c = await api.criar(base());
        await esperaErro(api.mudarStatus(c.id, 'fechado'), 409);
      });

      it('aberto → resolvido direto → 409', async () => {
        const c = await api.criar(base());
        await esperaErro(api.mudarStatus(c.id, 'resolvido', 'tentativa'), 409);
      });

      it('fluxo completo aberto → em_atendimento → resolvido → fechado', async () => {
        const c = await api.criar(base('P1'));
        assert.equal((await api.mudarStatus(c.id, 'em_atendimento')).status, 'em_atendimento');
        const r = await api.mudarStatus(c.id, 'resolvido', 'Cabo trocado.');
        assert.equal(r.status, 'resolvido');
        assert.equal(r.solucao, 'Cabo trocado.');
        assert.ok(r.resolvido_em, 'resolvido_em deve ser preenchido');
        assert.equal((await api.mudarStatus(c.id, 'fechado')).status, 'fechado');
      });

      it('em_atendimento → aberto (devolver à fila) é permitido', async () => {
        const c = await api.criar(base());
        await api.mudarStatus(c.id, 'em_atendimento');
        assert.equal((await api.mudarStatus(c.id, 'aberto')).status, 'aberto');
      });

      it('fechado não volta para nenhum status → 409', async () => {
        const c = await api.criar(base());
        await api.mudarStatus(c.id, 'em_atendimento');
        await api.mudarStatus(c.id, 'resolvido', 'ok');
        await api.mudarStatus(c.id, 'fechado');
        await esperaErro(api.mudarStatus(c.id, 'aberto'), 409);
      });

      it('chamado inexistente → 404', async () => {
        await esperaErro(api.mudarStatus(99999999, 'em_atendimento'), 404);
      });
    });

    describe('RF5 / CA2 — solução obrigatória', () => {
      it('CA2 — em_atendimento → resolvido sem solução → 400', async () => {
        const c = await api.criar(base());
        await api.mudarStatus(c.id, 'em_atendimento');
        await esperaErro(api.mudarStatus(c.id, 'resolvido'), 400);
      });

      it('solução só com espaços → 400', async () => {
        const c = await api.criar(base());
        await api.mudarStatus(c.id, 'em_atendimento');
        await esperaErro(api.mudarStatus(c.id, 'resolvido', '   '), 400);
      });
    });
  });
}
