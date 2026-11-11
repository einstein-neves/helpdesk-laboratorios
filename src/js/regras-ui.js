// Regras usadas pela INTERFACE para exibir dados (badges, botões, dashboard).
// Atenção: quem garante as regras de verdade é o backend (RF2, RF4, RF5).
// Aqui elas só servem para a tela mostrar o que faz sentido ao usuário.

export const PRIORIDADES = ['P1', 'P2', 'P3', 'P4'];

// RF2 — prazo de atendimento em horas por prioridade
export const SLA_HORAS = { P1: 4, P2: 8, P3: 24, P4: 72 };

export const STATUS = ['aberto', 'em_atendimento', 'resolvido', 'fechado'];

export const STATUS_LABEL = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

// RF4 — transições válidas (mesmo formato sugerido na "Dica para quem travar").
// A UI usa este mapa só para decidir quais botões aparecem em cada chamado.
export const TRANSICOES = {
  aberto: ['em_atendimento'],
  em_atendimento: ['aberto', 'resolvido'],
  resolvido: ['fechado'],
  fechado: [],
};

export const ACAO_LABEL = {
  em_atendimento: 'Atender',
  aberto: 'Devolver à fila',
  resolvido: 'Resolver',
  fechado: 'Fechar',
};

const HORA_MS = 60 * 60 * 1000;

export function proximosStatus(status) {
  return TRANSICOES[status] ?? [];
}

// RF2 / CA3 — prazo = abertura + horas da prioridade (ex.: P1 às 19:00 → 23:00)
export function calcularPrazo(abertoEm, prioridade) {
  const horas = SLA_HORAS[prioridade];
  if (horas === undefined) throw new Error(`Prioridade inválida: ${prioridade}`);
  return new Date(new Date(abertoEm).getTime() + horas * HORA_MS);
}

// RF6 — "SLA vencido" quando agora > prazo e o chamado não está resolvido nem fechado
export function slaVencido(chamado, agora = new Date()) {
  if (chamado.status === 'resolvido' || chamado.status === 'fechado') return false;
  return agora.getTime() > new Date(chamado.prazo_sla).getTime();
}

// RF3 / CA4 — prioridade primeiro (P1 antes de P4), depois o mais antigo primeiro
export function ordenarFila(lista) {
  return [...lista].sort((a, b) => {
    const p = PRIORIDADES.indexOf(a.prioridade) - PRIORIDADES.indexOf(b.prioridade);
    if (p !== 0) return p;
    return new Date(a.aberto_em) - new Date(b.aberto_em);
  });
}

// Validação do formulário antes de enviar (RF1 / CA5). O backend valida de novo.
export function validarNovoChamado(dados) {
  const erros = [];
  if (!dados.titulo?.trim()) erros.push('Informe o título.');
  if (!dados.descricao?.trim()) erros.push('Informe a descrição.');
  if (!dados.laboratorio?.trim()) erros.push('Informe o laboratório.');
  if (!PRIORIDADES.includes(dados.prioridade)) erros.push('Prioridade deve ser P1, P2, P3 ou P4.');
  return erros;
}

// Números do dashboard (inclui o extra "contagem por status")
export function resumo(lista, agora = new Date()) {
  const porStatus = Object.fromEntries(STATUS.map((s) => [s, 0]));
  const porPrioridade = Object.fromEntries(PRIORIDADES.map((p) => [p, 0]));
  const vencidos = [];

  for (const c of lista) {
    if (c.status in porStatus) porStatus[c.status]++;
    const ativo = c.status === 'aberto' || c.status === 'em_atendimento';
    if (ativo && c.prioridade in porPrioridade) porPrioridade[c.prioridade]++;
    if (slaVencido(c, agora)) vencidos.push(c);
  }

  return {
    total: lista.length,
    ativos: porStatus.aberto + porStatus.em_atendimento,
    porStatus,
    porPrioridade,
    slaVencidos: ordenarFila(vencidos),
  };
}

// Texto curto para a coluna "Prazo": "faltam 2h 15min" ou "vencido há 1h 05min"
export function tempoRestante(chamado, agora = new Date()) {
  if (chamado.status === 'resolvido' || chamado.status === 'fechado') return '—';
  const diff = new Date(chamado.prazo_sla).getTime() - agora.getTime();
  const txt = duracao(Math.abs(diff));
  return diff >= 0 ? `faltam ${txt}` : `vencido há ${txt}`;
}

export function duracao(ms) {
  const totalMin = Math.floor(ms / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${String(min).padStart(2, '0')}min`;
  return `${min}min`;
}

export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Estados e métricas do dashboard (inspirados em Zendesk / service desks)
// ---------------------------------------------------------------------------

// Fração do prazo que, quando resta menos que isso, deixa o SLA em "atenção" (âmbar).
// O Zendesk usa 15 min fixos; como nossos prazos vão de 4 h a 72 h, usamos 25% do prazo.
export const LIMIAR_ATENCAO = 0.25;

const finalizado = (c) => c.status === 'resolvido' || c.status === 'fechado';

// 'finalizado' | 'ok' | 'atencao' | 'vencido'
export function slaEstado(chamado, agora = new Date()) {
  if (finalizado(chamado)) return 'finalizado';
  const prazo = new Date(chamado.prazo_sla).getTime();
  const inicio = new Date(chamado.aberto_em).getTime();
  const resta = prazo - agora.getTime();
  if (resta < 0) return 'vencido';
  if (resta < (prazo - inicio) * LIMIAR_ATENCAO) return 'atencao';
  return 'ok';
}

// Contagem curta no estilo dos selos de SLA: "45m", "3h", "2d", "-1h"
export function slaCurto(chamado, agora = new Date()) {
  if (finalizado(chamado)) return '';
  const diff = new Date(chamado.prazo_sla).getTime() - agora.getTime();
  const sinal = diff < 0 ? '-' : '';
  const min = Math.abs(diff) / 60000;
  if (min < 60) return `${sinal}${Math.max(1, Math.round(min))}m`;
  if (min < 48 * 60) return `${sinal}${Math.round(min / 60)}h`;
  return `${sinal}${Math.round(min / 1440)}d`;
}

// "agora", "há 5 min", "há 3 h", "há 2 d"
export function tempoRelativo(iso, agora = new Date()) {
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} d`;
}

// % de chamados finalizados dentro do prazo (null se ainda não há finalizados)
export function cumprimentoSla(lista) {
  const fins = lista.filter((c) => finalizado(c) && c.resolvido_em);
  if (!fins.length) return null;
  const noPrazo = fins.filter((c) => new Date(c.resolvido_em) <= new Date(c.prazo_sla)).length;
  return Math.round((noPrazo / fins.length) * 100);
}

// Tempo médio entre abertura e resolução, em ms (null se não há resolvidos)
export function tempoMedioResolucao(lista) {
  const fins = lista.filter((c) => finalizado(c) && c.resolvido_em);
  if (!fins.length) return null;
  const soma = fins.reduce((s, c) => s + (new Date(c.resolvido_em) - new Date(c.aberto_em)), 0);
  return soma / fins.length;
}

// Abertos x resolvidos por dia nos últimos N dias (inclui hoje), do mais antigo ao mais novo
export function volumeDiario(lista, dias = 7, agora = new Date()) {
  const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const hoje = inicioDia(agora);
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - i);
    serie.push({ dia: ini, abertos: 0, resolvidos: 0 });
  }
  const indice = (iso) => serie.findIndex((s) => inicioDia(iso) === s.dia.getTime());
  for (const c of lista) {
    const a = indice(c.aberto_em);
    if (a >= 0) serie[a].abertos++;
    if (c.resolvido_em) {
      const r = indice(c.resolvido_em);
      if (r >= 0) serie[r].resolvidos++;
    }
  }
  return serie;
}

// Chamados ativos por laboratório, do maior para o menor
export function porLaboratorio(lista) {
  const mapa = new Map();
  for (const c of lista) {
    if (finalizado(c)) continue;
    mapa.set(c.laboratorio, (mapa.get(c.laboratorio) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([laboratorio, total]) => ({ laboratorio, total }))
    .sort((a, b) => b.total - a.total || a.laboratorio.localeCompare(b.laboratorio));
}

// Ativos que estão vencidos ou em atenção, do mais urgente para o menos
export function emRisco(lista, agora = new Date()) {
  return lista
    .filter((c) => ['vencido', 'atencao'].includes(slaEstado(c, agora)))
    .sort((a, b) => new Date(a.prazo_sla) - new Date(b.prazo_sla));
}

// Código exibido na tela, ex.: HD-12
export const codigo = (c) => `HD-${c.id}`;
