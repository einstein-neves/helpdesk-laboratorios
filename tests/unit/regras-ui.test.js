// Testes unitários das regras usadas pela interface (badges, botões e dashboard).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPrazo, slaVencido, ordenarFila, proximosStatus,
  validarNovoChamado, resumo, tempoRestante, duracao,
} from '../../src/js/regras-ui.js';

const HORA = 60 * 60 * 1000;

describe('calcularPrazo (RF2 / CA3)', () => {
  it('CA3 — P1 aberto às 19:00 → prazo 23:00 do mesmo dia', () => {
    const abertura = new Date(2026, 10, 4, 19, 0); // 04/11/2026 19:00 (horário local)
    const prazo = calcularPrazo(abertura, 'P1');
    assert.equal(prazo.getHours(), 23);
    assert.equal(prazo.getMinutes(), 0);
    assert.equal(prazo.getDate(), 4);
  });

  it('P2 = 8 h, P3 = 24 h, P4 = 72 h', () => {
    const t = new Date('2026-11-04T10:00:00Z');
    assert.equal(calcularPrazo(t, 'P2') - t, 8 * HORA);
    assert.equal(calcularPrazo(t, 'P3') - t, 24 * HORA);
    assert.equal(calcularPrazo(t, 'P4') - t, 72 * HORA);
  });

  it('P4 aberto na sexta 18:00 vence na segunda 18:00 (horas corridas)', () => {
    const sexta = new Date(2026, 10, 6, 18, 0);
    const prazo = calcularPrazo(sexta, 'P4');
    assert.equal(prazo.getDay(), 1);
    assert.equal(prazo.getHours(), 18);
  });

  it('prioridade inválida lança erro', () => {
    assert.throws(() => calcularPrazo(new Date(), 'P7'));
  });
});

describe('slaVencido (RF6)', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  const prazoPassado = '2026-11-04T11:00:00Z';
  const prazoFuturo = '2026-11-04T13:00:00Z';

  it('aberto com prazo passado → vencido', () => {
    assert.equal(slaVencido({ status: 'aberto', prazo_sla: prazoPassado }, agora), true);
  });
  it('em_atendimento com prazo passado → vencido', () => {
    assert.equal(slaVencido({ status: 'em_atendimento', prazo_sla: prazoPassado }, agora), true);
  });
  it('aberto com prazo futuro → não vencido', () => {
    assert.equal(slaVencido({ status: 'aberto', prazo_sla: prazoFuturo }, agora), false);
  });
  it('resolvido ou fechado nunca aparece como vencido', () => {
    assert.equal(slaVencido({ status: 'resolvido', prazo_sla: prazoPassado }, agora), false);
    assert.equal(slaVencido({ status: 'fechado', prazo_sla: prazoPassado }, agora), false);
  });
  it('exatamente no prazo ainda não venceu (regra é agora > prazo)', () => {
    assert.equal(slaVencido({ status: 'aberto', prazo_sla: agora.toISOString() }, agora), false);
  });
});

describe('ordenarFila (RF3 / CA4)', () => {
  it('CA4 — P1 aberto depois de um P3 fica antes do P3', () => {
    const fila = ordenarFila([
      { id: 1, prioridade: 'P3', aberto_em: '2026-11-04T08:00:00Z' },
      { id: 2, prioridade: 'P1', aberto_em: '2026-11-04T09:00:00Z' },
    ]);
    assert.deepEqual(fila.map((c) => c.id), [2, 1]);
  });

  it('mesma prioridade: mais antigo primeiro', () => {
    const fila = ordenarFila([
      { id: 1, prioridade: 'P2', aberto_em: '2026-11-04T10:00:00Z' },
      { id: 2, prioridade: 'P2', aberto_em: '2026-11-04T08:00:00Z' },
      { id: 3, prioridade: 'P4', aberto_em: '2026-11-01T08:00:00Z' },
      { id: 4, prioridade: 'P1', aberto_em: '2026-11-04T11:00:00Z' },
    ]);
    assert.deepEqual(fila.map((c) => c.id), [4, 2, 1, 3]);
  });

  it('não altera a lista original', () => {
    const lista = [{ id: 1, prioridade: 'P4', aberto_em: 'x' }, { id: 2, prioridade: 'P1', aberto_em: 'x' }];
    ordenarFila(lista);
    assert.equal(lista[0].id, 1);
  });
});

describe('proximosStatus (botões da fila — RF4)', () => {
  it('aberto só pode ir para em_atendimento', () => {
    assert.deepEqual(proximosStatus('aberto'), ['em_atendimento']);
  });
  it('em_atendimento pode voltar à fila ou ser resolvido', () => {
    assert.deepEqual(proximosStatus('em_atendimento').sort(), ['aberto', 'resolvido']);
  });
  it('resolvido só pode ser fechado', () => {
    assert.deepEqual(proximosStatus('resolvido'), ['fechado']);
  });
  it('fechado não mostra nenhum botão', () => {
    assert.deepEqual(proximosStatus('fechado'), []);
  });
  it('aberto NÃO oferece "fechado" (CA1 na interface)', () => {
    assert.ok(!proximosStatus('aberto').includes('fechado'));
  });
  it('status desconhecido não quebra a tela', () => {
    assert.deepEqual(proximosStatus('xyz'), []);
  });
});

describe('validarNovoChamado (formulário — RF1 / CA5)', () => {
  const ok = { titulo: 'Projetor', descricao: 'Não liga', laboratorio: 'Lab 01', prioridade: 'P1' };
  it('dados completos não têm erros', () => {
    assert.deepEqual(validarNovoChamado(ok), []);
  });
  it('CA5 — P7 é rejeitado', () => {
    assert.equal(validarNovoChamado({ ...ok, prioridade: 'P7' }).length, 1);
  });
  it('campos em branco (só espaços) são rejeitados', () => {
    assert.equal(validarNovoChamado({ ...ok, titulo: '   ', descricao: '', laboratorio: ' ' }).length, 3);
  });
});

describe('resumo (dashboard)', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  const lista = [
    { id: 1, prioridade: 'P1', status: 'aberto', aberto_em: '2026-11-04T06:00:00Z', prazo_sla: '2026-11-04T10:00:00Z' },
    { id: 2, prioridade: 'P1', status: 'em_atendimento', aberto_em: '2026-11-04T11:00:00Z', prazo_sla: '2026-11-04T15:00:00Z' },
    { id: 3, prioridade: 'P3', status: 'aberto', aberto_em: '2026-11-02T08:00:00Z', prazo_sla: '2026-11-03T08:00:00Z' },
    { id: 4, prioridade: 'P2', status: 'resolvido', aberto_em: '2026-11-01T08:00:00Z', prazo_sla: '2026-11-01T16:00:00Z' },
    { id: 5, prioridade: 'P4', status: 'fechado', aberto_em: '2026-10-20T08:00:00Z', prazo_sla: '2026-10-23T08:00:00Z' },
  ];
  const r = resumo(lista, agora);

  it('conta por status (extra "contagem por status")', () => {
    assert.deepEqual(r.porStatus, { aberto: 2, em_atendimento: 1, resolvido: 1, fechado: 1 });
    assert.equal(r.total, 5);
    assert.equal(r.ativos, 3);
  });
  it('por prioridade conta só chamados ativos', () => {
    assert.deepEqual(r.porPrioridade, { P1: 2, P2: 0, P3: 1, P4: 0 });
  });
  it('lista de SLA vencido ignora resolvidos/fechados e vem ordenada', () => {
    assert.deepEqual(r.slaVencidos.map((c) => c.id), [1, 3]);
  });
  it('lista vazia não quebra', () => {
    const v = resumo([], agora);
    assert.equal(v.total, 0);
    assert.equal(v.slaVencidos.length, 0);
  });
});

describe('tempoRestante / duracao (coluna Prazo)', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  it('antes do prazo mostra "faltam"', () => {
    assert.equal(tempoRestante({ status: 'aberto', prazo_sla: '2026-11-04T14:15:00Z' }, agora), 'faltam 2h 15min');
  });
  it('depois do prazo mostra "vencido há"', () => {
    assert.equal(tempoRestante({ status: 'aberto', prazo_sla: '2026-11-04T11:55:00Z' }, agora), 'vencido há 5min');
  });
  it('resolvido mostra traço', () => {
    assert.equal(tempoRestante({ status: 'resolvido', prazo_sla: '2026-11-04T11:00:00Z' }, agora), '—');
  });
  it('mais de um dia mostra em dias', () => {
    assert.equal(duracao(50 * HORA), '2d 2h');
  });
});
