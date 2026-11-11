// Testes unitários das regras usadas pelo dashboard (selos, botões, fila).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPrazo, prazo, nivel, dataResolucao, slaVencido, ordenarFila, proximosStatus,
  validarNovoChamado, resumo, tempoRestante, duracao,
} from '../../publico/js/dashboard/regras-ui.js';

const HORA = 60 * 60 * 1000;

describe('calcularPrazo (RF2 / CA3)', () => {
  it('CA3 — P1 aberto às 19:00 → prazo 23:00 do mesmo dia', () => {
    const abertura = new Date(2026, 10, 4, 19, 0); // 04/11/2026 19:00 (horário local)
    const p = calcularPrazo(abertura, 'P1');
    assert.equal(p.getHours(), 23);
    assert.equal(p.getMinutes(), 0);
    assert.equal(p.getDate(), 4);
  });

  it('P2 = 8 h, P3 = 24 h, P4 = 72 h', () => {
    const t = new Date('2026-11-04T10:00:00Z');
    assert.equal(calcularPrazo(t, 'P2') - t, 8 * HORA);
    assert.equal(calcularPrazo(t, 'P3') - t, 24 * HORA);
    assert.equal(calcularPrazo(t, 'P4') - t, 72 * HORA);
  });

  it('P4 aberto na sexta 18:00 vence na segunda 18:00 (horas corridas)', () => {
    const p = calcularPrazo(new Date(2026, 10, 6, 18, 0), 'P4');
    assert.equal(p.getDay(), 1);
    assert.equal(p.getHours(), 18);
  });

  it('nível inválido lança erro', () => {
    assert.throws(() => calcularPrazo(new Date(), 'P7'));
  });
});

describe('nivel e prazo (compatibilidade com os dados da equipe)', () => {
  it('usa nivelSla quando existe', () => {
    assert.equal(nivel({ nivelSla: 'P1', prioridade: 'ALTA' }), 'P1');
  });
  it('sem nivelSla, deduz pela prioridade (ALTA→P2, MEDIA→P3, BAIXA→P4)', () => {
    assert.equal(nivel({ prioridade: 'ALTA' }), 'P2');
    assert.equal(nivel({ prioridade: 'MEDIA' }), 'P3');
    assert.equal(nivel({ prioridade: 'BAIXA' }), 'P4');
  });
  it('usa prazoSla salvo pela tela de abertura', () => {
    const c = { nivelSla: 'P1', dataAbertura: '2026-11-04T10:00:00Z', prazoSla: '2026-11-04T15:00:00Z' };
    assert.equal(prazo(c).toISOString(), '2026-11-04T15:00:00.000Z');
  });
  it('sem prazoSla, calcula pela abertura', () => {
    const c = { prioridade: 'MEDIA', dataAbertura: '2026-11-04T10:00:00Z' };
    assert.equal(prazo(c).toISOString(), '2026-11-05T10:00:00.000Z');
  });
  it('dataResolucao: usa o campo; senão dataAtualizacao de finalizados; senão null', () => {
    assert.equal(dataResolucao({ status: 'FECHADO', dataResolucao: 'a', dataAtualizacao: 'b' }), 'a');
    assert.equal(dataResolucao({ status: 'RESOLVIDO', dataAtualizacao: 'b' }), 'b');
    assert.equal(dataResolucao({ status: 'PENDENTE', dataAtualizacao: 'b' }), null);
  });
});

describe('slaVencido (RF6)', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  const base = { nivelSla: 'P1', dataAbertura: '2026-11-04T05:00:00Z' };
  const passado = { ...base, prazoSla: '2026-11-04T11:00:00Z' };
  const futuro = { ...base, prazoSla: '2026-11-04T13:00:00Z' };

  it('ABERTO, EM_ATENDIMENTO e PENDENTE com prazo passado → vencido', () => {
    for (const status of ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE']) {
      assert.equal(slaVencido({ ...passado, status }, agora), true, status);
    }
  });
  it('prazo futuro → não vencido', () => {
    assert.equal(slaVencido({ ...futuro, status: 'ABERTO' }, agora), false);
  });
  it('RESOLVIDO ou FECHADO nunca aparece como vencido', () => {
    assert.equal(slaVencido({ ...passado, status: 'RESOLVIDO' }, agora), false);
    assert.equal(slaVencido({ ...passado, status: 'FECHADO' }, agora), false);
  });
  it('exatamente no prazo ainda não venceu (regra é agora > prazo)', () => {
    assert.equal(slaVencido({ ...base, status: 'ABERTO', prazoSla: agora.toISOString() }, agora), false);
  });
});

describe('ordenarFila (RF3 / CA4)', () => {
  it('CA4 — P1 aberto depois de um P3 fica antes do P3', () => {
    const fila = ordenarFila([
      { id: 1, nivelSla: 'P3', dataAbertura: '2026-11-04T08:00:00Z' },
      { id: 2, nivelSla: 'P1', dataAbertura: '2026-11-04T09:00:00Z' },
    ]);
    assert.deepEqual(fila.map((c) => c.id), [2, 1]);
  });

  it('mesmo nível: mais antigo primeiro; chamados sem nivelSla entram pela prioridade', () => {
    const fila = ordenarFila([
      { id: 1, nivelSla: 'P2', dataAbertura: '2026-11-04T10:00:00Z' },
      { id: 2, prioridade: 'ALTA', dataAbertura: '2026-11-04T08:00:00Z' }, // vira P2
      { id: 3, prioridade: 'BAIXA', dataAbertura: '2026-11-01T08:00:00Z' },
      { id: 4, nivelSla: 'P1', dataAbertura: '2026-11-04T11:00:00Z' },
    ]);
    assert.deepEqual(fila.map((c) => c.id), [4, 2, 1, 3]);
  });

  it('não altera a lista original', () => {
    const lista = [{ id: 1, nivelSla: 'P4', dataAbertura: 'x' }, { id: 2, nivelSla: 'P1', dataAbertura: 'x' }];
    ordenarFila(lista);
    assert.equal(lista[0].id, 1);
  });
});

describe('proximosStatus (mesmas transições do backend)', () => {
  it('ABERTO só vai para EM_ATENDIMENTO', () => {
    assert.deepEqual(proximosStatus('ABERTO'), ['EM_ATENDIMENTO']);
  });
  it('EM_ATENDIMENTO vai para PENDENTE ou RESOLVIDO', () => {
    assert.deepEqual(proximosStatus('EM_ATENDIMENTO'), ['PENDENTE', 'RESOLVIDO']);
  });
  it('PENDENTE volta ao atendimento ou é resolvido', () => {
    assert.deepEqual(proximosStatus('PENDENTE'), ['EM_ATENDIMENTO', 'RESOLVIDO']);
  });
  it('RESOLVIDO só pode ser FECHADO', () => {
    assert.deepEqual(proximosStatus('RESOLVIDO'), ['FECHADO']);
  });
  it('FECHADO não mostra nenhuma ação', () => {
    assert.deepEqual(proximosStatus('FECHADO'), []);
  });
  it('ABERTO NÃO oferece FECHADO (CA1 na interface)', () => {
    assert.ok(!proximosStatus('ABERTO').includes('FECHADO'));
  });
  it('status desconhecido não quebra a tela', () => {
    assert.deepEqual(proximosStatus('xyz'), []);
  });
});

describe('validarNovoChamado (RF1 / CA5)', () => {
  const ok = { titulo: 'Projetor', descricao: 'Não liga', laboratorio: 'Laboratório 01', nivelSla: 'P1' };
  it('dados completos não têm erros', () => {
    assert.deepEqual(validarNovoChamado(ok), []);
  });
  it('CA5 — P7 é rejeitado', () => {
    assert.equal(validarNovoChamado({ ...ok, nivelSla: 'P7' }).length, 1);
  });
  it('campos em branco (só espaços) são rejeitados', () => {
    assert.equal(validarNovoChamado({ ...ok, titulo: '   ', descricao: '', laboratorio: ' ' }).length, 3);
  });
});

describe('resumo (dashboard)', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  const lista = [
    { id: 1, nivelSla: 'P1', status: 'ABERTO', dataAbertura: '2026-11-04T06:00:00Z', prazoSla: '2026-11-04T10:00:00Z' },
    { id: 2, nivelSla: 'P1', status: 'EM_ATENDIMENTO', dataAbertura: '2026-11-04T11:00:00Z', prazoSla: '2026-11-04T15:00:00Z' },
    { id: 3, nivelSla: 'P3', status: 'PENDENTE', dataAbertura: '2026-11-02T08:00:00Z', prazoSla: '2026-11-03T08:00:00Z' },
    { id: 4, nivelSla: 'P2', status: 'RESOLVIDO', dataAbertura: '2026-11-01T08:00:00Z', prazoSla: '2026-11-01T16:00:00Z' },
    { id: 5, nivelSla: 'P4', status: 'FECHADO', dataAbertura: '2026-10-20T08:00:00Z', prazoSla: '2026-10-23T08:00:00Z' },
  ];
  const r = resumo(lista, agora);

  it('conta por status (extra "contagem por status")', () => {
    assert.deepEqual(r.porStatus, { ABERTO: 1, EM_ATENDIMENTO: 1, PENDENTE: 1, RESOLVIDO: 1, FECHADO: 1 });
    assert.equal(r.total, 5);
    assert.equal(r.ativos, 3);
  });
  it('por nível conta só chamados ativos', () => {
    assert.deepEqual(r.porNivel, { P1: 2, P2: 0, P3: 1, P4: 0 });
  });
  it('SLA vencido ignora finalizados e vem ordenado', () => {
    assert.deepEqual(r.slaVencidos.map((c) => c.id), [1, 3]);
  });
  it('lista vazia não quebra', () => {
    assert.equal(resumo([], agora).total, 0);
  });
});

describe('tempoRestante / duracao', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  const c = (prazoSla, status = 'ABERTO') => ({ status, nivelSla: 'P1', dataAbertura: '2026-11-04T10:00:00Z', prazoSla });
  it('antes do prazo mostra "faltam"', () => {
    assert.equal(tempoRestante(c('2026-11-04T14:15:00Z'), agora), 'faltam 2h 15min');
  });
  it('depois do prazo mostra "vencido há"', () => {
    assert.equal(tempoRestante(c('2026-11-04T11:55:00Z'), agora), 'vencido há 5min');
  });
  it('finalizado mostra traço', () => {
    assert.equal(tempoRestante(c('2026-11-04T11:00:00Z', 'RESOLVIDO'), agora), '—');
  });
  it('mais de um dia mostra em dias', () => {
    assert.equal(duracao(50 * HORA), '2d 2h');
  });
});
