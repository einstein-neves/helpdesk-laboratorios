// Regras usadas pela INTERFACE do dashboard (selos, botões, métricas).
// Segue o contrato da equipe (docs/contratos-api.md):
//   status ABERTO | EM_ATENDIMENTO | PENDENTE | RESOLVIDO | FECHADO
//   prioridade ALTA | MEDIA | BAIXA  +  nivelSla P1..P4 e prazoSla (tela de abertura)
// Quem garante as regras de verdade é o backend; aqui elas servem para exibir.

// ---------------------------------------------------------------------------
// Níveis de SLA (RF2)
// ---------------------------------------------------------------------------
export const NIVEIS = ['P1', 'P2', 'P3', 'P4'];
export const SLA_HORAS = { P1: 4, P2: 8, P3: 24, P4: 72 };
export const NIVEL_LABEL = { P1: 'Urgente', P2: 'Alta', P3: 'Normal', P4: 'Baixa' };

// Mesmo mapeamento da tela de abertura (publico/js/abertura.js)
export const PRIORIDADE_DO_NIVEL = { P1: 'ALTA', P2: 'ALTA', P3: 'MEDIA', P4: 'BAIXA' };
// Para chamados antigos sem nivelSla, usamos o nível mais brando de cada prioridade
const NIVEL_DA_PRIORIDADE = { ALTA: 'P2', MEDIA: 'P3', BAIXA: 'P4' };

// ---------------------------------------------------------------------------
// Status e transições (iguais ao backend: backend/src/services/statusService.js)
// ---------------------------------------------------------------------------
export const STATUS = ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'RESOLVIDO', 'FECHADO'];

export const STATUS_LABEL = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em atendimento',
  PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

export const TRANSICOES = {
  ABERTO: ['EM_ATENDIMENTO'],
  EM_ATENDIMENTO: ['PENDENTE', 'RESOLVIDO'],
  PENDENTE: ['EM_ATENDIMENTO', 'RESOLVIDO'],
  RESOLVIDO: ['FECHADO'],
  FECHADO: [],
};

export const ACAO_LABEL = {
  EM_ATENDIMENTO: 'Retomar atendimento',
  PENDENTE: 'Marcar como pendente',
  RESOLVIDO: 'Resolver',
  FECHADO: 'Fechar',
};

const HORA_MS = 60 * 60 * 1000;

export const finalizado = (c) => c.status === 'RESOLVIDO' || c.status === 'FECHADO';
export const ativo = (c) => !finalizado(c);

export function proximosStatus(status) {
  return TRANSICOES[status] ?? [];
}

// Nível P1..P4 do chamado (usa nivelSla; se não houver, deduz pela prioridade)
export function nivel(c) {
  if (NIVEIS.includes(c.nivelSla)) return c.nivelSla;
  return NIVEL_DA_PRIORIDADE[c.prioridade] ?? 'P4';
}

// RF2 / CA3 — prazo = abertura + horas do nível (ex.: P1 às 19:00 → 23:00)
export function calcularPrazo(dataAbertura, nivelSla) {
  const horas = SLA_HORAS[nivelSla];
  if (horas === undefined) throw new Error(`Nível de SLA inválido: ${nivelSla}`);
  return new Date(new Date(dataAbertura).getTime() + horas * HORA_MS);
}

// Prazo do chamado: usa prazoSla salvo; se não houver, calcula
export function prazo(c) {
  return c.prazoSla ? new Date(c.prazoSla) : calcularPrazo(c.dataAbertura, nivel(c));
}

// Quando o chamado foi resolvido. O contrato ainda não tem "dataResolucao";
// enquanto isso, para chamados finalizados usamos dataAtualizacao.
export function dataResolucao(c) {
  if (c.dataResolucao) return c.dataResolucao;
  return finalizado(c) ? c.dataAtualizacao ?? null : null;
}

// RF6 — "SLA vencido" quando agora > prazo e o chamado não está resolvido nem fechado
export function slaVencido(c, agora = new Date()) {
  if (finalizado(c)) return false;
  return agora.getTime() > prazo(c).getTime();
}

// RF3 / CA4 — nível primeiro (P1 antes de P4), depois o mais antigo primeiro
export function ordenarFila(lista) {
  return [...lista].sort((a, b) => {
    const p = NIVEIS.indexOf(nivel(a)) - NIVEIS.indexOf(nivel(b));
    if (p !== 0) return p;
    return new Date(a.dataAbertura) - new Date(b.dataAbertura);
  });
}

// Validação dos dados de um novo chamado (RF1 / CA5). Usada pelo mock.
export function validarNovoChamado(dados) {
  const erros = [];
  if (!dados.titulo?.trim()) erros.push('Informe o título.');
  if (!dados.descricao?.trim()) erros.push('Informe a descrição.');
  if (!dados.laboratorio?.trim()) erros.push('Informe o laboratório.');
  if (!NIVEIS.includes(dados.nivelSla)) erros.push('Prioridade inválida. Use de P1 a P4.');
  return erros;
}

// ---------------------------------------------------------------------------
// Estados e métricas do dashboard
// ---------------------------------------------------------------------------

// Quando resta menos que esta fração do prazo, o selo fica em "atenção" (âmbar).
// O Zendesk usa 15 min fixos; como nossos prazos vão de 4 h a 72 h, usamos 25%.
export const LIMIAR_ATENCAO = 0.25;

// 'finalizado' | 'ok' | 'atencao' | 'vencido'
export function slaEstado(c, agora = new Date()) {
  if (finalizado(c)) return 'finalizado';
  const fim = prazo(c).getTime();
  const inicio = new Date(c.dataAbertura).getTime();
  const resta = fim - agora.getTime();
  if (resta < 0) return 'vencido';
  if (resta < (fim - inicio) * LIMIAR_ATENCAO) return 'atencao';
  return 'ok';
}

// Texto curto do selo: "45m", "3h", "2d", "-1h"
export function slaCurto(c, agora = new Date()) {
  if (finalizado(c)) return '';
  const diff = prazo(c).getTime() - agora.getTime();
  const sinal = diff < 0 ? '-' : '';
  const min = Math.abs(diff) / 60000;
  if (min < 60) return `${sinal}${Math.max(1, Math.round(min))}m`;
  if (min < 48 * 60) return `${sinal}${Math.round(min / 60)}h`;
  return `${sinal}${Math.round(min / 1440)}d`;
}

// Números principais (inclui o extra "contagem por status")
export function resumo(lista, agora = new Date()) {
  const porStatus = Object.fromEntries(STATUS.map((s) => [s, 0]));
  const porNivel = Object.fromEntries(NIVEIS.map((n) => [n, 0]));
  const vencidos = [];
  for (const c of lista) {
    if (c.status in porStatus) porStatus[c.status]++;
    if (ativo(c)) porNivel[nivel(c)]++;
    if (slaVencido(c, agora)) vencidos.push(c);
  }
  return {
    total: lista.length,
    ativos: porStatus.ABERTO + porStatus.EM_ATENDIMENTO + porStatus.PENDENTE,
    porStatus,
    porNivel,
    slaVencidos: ordenarFila(vencidos),
  };
}

// % de chamados finalizados dentro do prazo (null se ainda não há finalizados)
export function cumprimentoSla(lista) {
  const fins = lista.filter((c) => finalizado(c) && dataResolucao(c));
  if (!fins.length) return null;
  const noPrazo = fins.filter((c) => new Date(dataResolucao(c)) <= prazo(c)).length;
  return Math.round((noPrazo / fins.length) * 100);
}

// Tempo médio entre abertura e resolução, em ms (null se não há finalizados)
export function tempoMedioResolucao(lista) {
  const fins = lista.filter((c) => finalizado(c) && dataResolucao(c));
  if (!fins.length) return null;
  const soma = fins.reduce((s, c) => s + (new Date(dataResolucao(c)) - new Date(c.dataAbertura)), 0);
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
    const a = indice(c.dataAbertura);
    if (a >= 0) serie[a].abertos++;
    const res = dataResolucao(c);
    if (res) {
      const r = indice(res);
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

// Ativos vencidos ou em atenção, do prazo mais próximo para o mais distante
export function emRisco(lista, agora = new Date()) {
  return lista
    .filter((c) => ['vencido', 'atencao'].includes(slaEstado(c, agora)))
    .sort((a, b) => prazo(a) - prazo(b));
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------
export const codigo = (c) => `#${c.id}`;

export function tempoRestante(c, agora = new Date()) {
  if (finalizado(c)) return '—';
  const diff = prazo(c).getTime() - agora.getTime();
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

export function tempoRelativo(iso, agora = new Date()) {
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} d`;
}

export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
