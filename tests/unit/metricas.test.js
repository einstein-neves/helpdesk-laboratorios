// Testes das métricas e estados usados no dashboard e nos selos de SLA.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  slaEstado, slaCurto, tempoRelativo, cumprimentoSla, tempoMedioResolucao,
  volumeDiario, porLaboratorio, emRisco, codigo,
} from '../../src/js/regras-ui.js';

const HORA = 60 * 60 * 1000;
const agora = new Date('2026-11-04T12:00:00Z');
const iso = (msAntes) => new Date(agora.getTime() - msAntes).toISOString();

// P1 (janela de 4 h) aberto há X horas
const p1 = (abertoHaH, status = 'aberto') => ({
  status, prioridade: 'P1', aberto_em: iso(abertoHaH * HORA), prazo_sla: iso((abertoHaH - 4) * HORA),
});

describe('slaEstado (cores dos selos)', () => {
  it('início do prazo → ok (verde)', () => assert.equal(slaEstado(p1(1), agora), 'ok'));
  it('menos de 25% do prazo restante → atenção (âmbar)', () => assert.equal(slaEstado(p1(3.5), agora), 'atencao'));
  it('exatamente 25% restante ainda é ok', () => assert.equal(slaEstado(p1(3), agora), 'ok'));
  it('prazo passou → vencido (vermelho)', () => assert.equal(slaEstado(p1(5), agora), 'vencido'));
  it('resolvido/fechado → finalizado, mesmo com prazo passado', () => {
    assert.equal(slaEstado(p1(5, 'resolvido'), agora), 'finalizado');
    assert.equal(slaEstado(p1(5, 'fechado'), agora), 'finalizado');
  });
});

describe('slaCurto (texto do selo)', () => {
  it('minutos', () => assert.equal(slaCurto(p1(3.5), agora), '30m'));
  it('horas', () => assert.equal(slaCurto(p1(1), agora), '3h'));
  it('negativo quando vencido', () => assert.equal(slaCurto(p1(6), agora), '-2h'));
  it('dias acima de 48 h', () => {
    assert.equal(slaCurto({ status: 'aberto', prazo_sla: new Date(agora.getTime() + 72 * HORA).toISOString() }, agora), '3d');
  });
  it('finalizado não mostra contagem', () => assert.equal(slaCurto(p1(1, 'fechado'), agora), ''));
});

describe('tempoRelativo', () => {
  it('agora / minutos / horas / dias', () => {
    assert.equal(tempoRelativo(iso(10_000), agora), 'agora');
    assert.equal(tempoRelativo(iso(5 * 60_000), agora), 'há 5 min');
    assert.equal(tempoRelativo(iso(3 * HORA), agora), 'há 3 h');
    assert.equal(tempoRelativo(iso(50 * HORA), agora), 'há 2 d');
  });
});

describe('cumprimentoSla e tempoMedioResolucao', () => {
  const fin = (abertoH, levouH, prazoH, status = 'resolvido') => {
    const a = new Date(agora.getTime() - abertoH * HORA);
    return {
      status, aberto_em: a.toISOString(),
      prazo_sla: new Date(a.getTime() + prazoH * HORA).toISOString(),
      resolvido_em: new Date(a.getTime() + levouH * HORA).toISOString(),
    };
  };
  const lista = [fin(10, 2, 4), fin(20, 6, 4, 'fechado'), fin(30, 8, 8), fin(40, 4, 24), p1(1)];

  it('3 de 4 finalizados no prazo → 75%', () => assert.equal(cumprimentoSla(lista), 75));
  it('sem finalizados → null', () => assert.equal(cumprimentoSla([p1(1)]), null));
  it('tempo médio = (2+6+8+4)/4 = 5 h', () => assert.equal(tempoMedioResolucao(lista), 5 * HORA));
  it('sem finalizados → null', () => assert.equal(tempoMedioResolucao([]), null));
});

describe('volumeDiario', () => {
  const hoje = new Date(2026, 10, 7, 15, 0);
  const em = (diasAtras, h = 10) => new Date(2026, 10, 7 - diasAtras, h).toISOString();
  const lista = [
    { aberto_em: em(0), resolvido_em: null },
    { aberto_em: em(0, 8), resolvido_em: em(0, 12) },
    { aberto_em: em(2), resolvido_em: em(1) },
    { aberto_em: em(10), resolvido_em: em(6) }, // aberto fora da janela, resolvido dentro
  ];
  const s = volumeDiario(lista, 7, hoje);

  it('devolve 7 dias, do mais antigo para hoje', () => {
    assert.equal(s.length, 7);
    assert.equal(s[6].dia.getDate(), 7);
    assert.equal(s[0].dia.getDate(), 1);
  });
  it('conta abertos e resolvidos no dia certo', () => {
    assert.deepEqual([s[6].abertos, s[6].resolvidos], [2, 1]);
    assert.deepEqual([s[4].abertos, s[5].resolvidos], [1, 1]);
    assert.equal(s[0].resolvidos, 1);
    assert.equal(s.reduce((t, d) => t + d.abertos, 0), 3);
  });
});

describe('porLaboratorio e emRisco', () => {
  const lista = [
    { ...p1(5), laboratorio: 'Lab 02' },             // vencido
    { ...p1(3.5), laboratorio: 'Lab 01' },           // atenção
    { ...p1(1), laboratorio: 'Lab 01' },             // ok
    { ...p1(9, 'fechado'), laboratorio: 'Lab 03' },  // finalizado
  ];
  it('conta só ativos, maior primeiro', () => {
    assert.deepEqual(porLaboratorio(lista), [{ laboratorio: 'Lab 01', total: 2 }, { laboratorio: 'Lab 02', total: 1 }]);
  });
  it('em risco = vencidos + atenção, prazo mais próximo primeiro', () => {
    assert.deepEqual(emRisco(lista, agora).map((c) => c.laboratorio), ['Lab 02', 'Lab 01']);
  });
});

describe('codigo', () => {
  it('formata HD-<id>', () => assert.equal(codigo({ id: 12 }), 'HD-12'));
});
