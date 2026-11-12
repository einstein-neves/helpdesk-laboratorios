// Dashboard do Help Desk: indicadores, acompanhamento dos chamados, painel de
// detalhes com histórico, mudança de status, paleta de comandos (Ctrl+K) e atalhos.
// Abrir chamado e assumir chamado ficam nas telas da equipe (abertura.html e
// atendimentos.html) — este módulo só leva o usuário até elas.
import { CONFIG } from './config.js';
import { criarCliente } from './api.js';
import {
  ACAO_LABEL, NIVEIS, NIVEL_LABEL, SLA_HORAS, STATUS, STATUS_LABEL,
  ativo, codigo, cumprimentoSla, dataResolucao, duracao, emRisco, formatarDataHora,
  nivel, ordenarFila, porLaboratorio, prazo, proximosStatus, resumo, slaCurto,
  slaEstado, tempoMedioResolucao, tempoRelativo, volumeDiario,
} from './regras-ui.js';

const api = criarCliente(CONFIG);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const TELA_ABERTURA = 'abertura.html';
const TELA_ATENDIMENTOS = 'atendimentos.html';
const ESTADO_SLA_LABEL = { ok: 'No prazo', atencao: 'Perto de vencer', vencido: 'SLA vencido', finalizado: 'Finalizado' };
const FILTROS = [
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'todos', rotulo: 'Todos' },
  ...STATUS.map((s) => ({ id: s, rotulo: STATUS_LABEL[s] })),
  { id: 'risco', rotulo: 'SLA em risco' },
];

const estado = {
  todos: [],          // todos os chamados (dashboard e contadores)
  rota: 'dashboard',
  filtro: 'ativos',
  busca: '',
  gavetaId: null,     // chamado aberto no painel lateral
  historico: null,    // histórico do chamado aberto no painel
  resolvendoId: null,
};

// =========================================================================
// Utilidades
// =========================================================================
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function aviso(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.textContent = msg;
  $('#avisos').append(el);
  setTimeout(() => el.remove(), 4500);
}

function mensagemErro(e) {
  if (e.status === 409) return `Transição não permitida (409): ${e.message}`;
  if (e.status === 400) return `Dados inválidos (400): ${e.message}`;
  if (e.status === 401) return 'Faça login para alterar chamados (401).';
  if (e.status === 404) return 'Chamado não encontrado (404).';
  return e.message || 'Erro inesperado.';
}

const acharChamado = (id) => estado.todos.find((c) => c.id === Number(id));
const prazoIso = (c) => prazo(c).toISOString();

// ---------- ícones ----------
// Nível de SLA no estilo "sinal" (P1 = alerta cheio; P2..P4 = 3, 2 e 1 barras)
function icoNivel(n) {
  if (n === 'P1') {
    return `<svg class="ico-pri P1" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5"/><path d="M8 4.4v4.8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.8" r="1.15" fill="#fff"/></svg>`;
  }
  const ligadas = { P2: 3, P3: 2, P4: 1 }[n] ?? 0;
  const barras = [5, 8, 11].map((h, i) =>
    `<rect class="${i < ligadas ? 'on' : 'off'}" x="${1.5 + i * 5}" y="${14 - h}" width="3" height="${h}" rx="1"/>`).join('');
  return `<svg class="ico-pri" viewBox="0 0 16 16" aria-hidden="true">${barras}</svg>`;
}

function icoStatus(s) {
  const base = `<svg class="ico-status st-${s}" viewBox="0 0 14 14" aria-hidden="true">`;
  const anel = '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/>';
  if (s === 'ABERTO') return `${base}${anel}</svg>`;
  if (s === 'EM_ATENDIMENTO') return `${base}${anel}<path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z"/></svg>`;
  if (s === 'PENDENTE') return `${base}${anel}<rect x="4.9" y="4.6" width="1.4" height="4.8" rx=".5"/><rect x="7.7" y="4.6" width="1.4" height="4.8" rx=".5"/></svg>`;
  return `${base}<circle cx="7" cy="7" r="6.3"/><path class="checkmark" d="m4.4 7.2 1.8 1.8 3.4-3.6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const pilulaStatus = (s) => `<span class="pilula">${icoStatus(s)}${STATUS_LABEL[s] ?? esc(s)}</span>`;
const chipLab = (l) => `<span class="chip-lab"><svg><use href="#i-monitor"/></svg>${esc(l)}</span>`;

// Selo de SLA no padrão Zendesk: verde (no prazo), âmbar (perto), vermelho (vencido, negativo)
function seloSla(c) {
  const e = slaEstado(c);
  if (e === 'finalizado') return '<span class="sla sla-finalizado">—</span>';
  const titulo = `${ESTADO_SLA_LABEL[e]} · prazo ${formatarDataHora(prazoIso(c))}`;
  return `<span class="sla sla-${e}" title="${titulo}" aria-label="${titulo}"><svg><use href="#i-relogio"/></svg>${slaCurto(c)}</span>`;
}

// ---------- tooltip compartilhado pelos gráficos ----------
const tooltip = $('#tooltip');
function mostrarTooltip(_ev, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
}
const esconderTooltip = () => { tooltip.hidden = true; };

// =========================================================================
// Navegação (#dashboard, #fila, #fila/<filtro>)
// =========================================================================
function aplicarRota() {
  const [rota, filtro] = (location.hash.slice(1) || 'dashboard').split('/');
  estado.rota = rota === 'fila' ? 'fila' : 'dashboard';
  if (estado.rota === 'fila') estado.filtro = FILTROS.some((f) => f.id === filtro) ? filtro : 'ativos';

  $$('[data-secao]').forEach((s) => { s.hidden = s.dataset.secao !== estado.rota; });
  const chaveMenu = estado.rota === 'fila' && estado.filtro === 'risco' ? 'fila/risco' : estado.rota;
  $$('[data-rota]').forEach((a) => {
    const atual = a.dataset.rota === chaveMenu;
    a.classList.toggle('ativo', atual);
    if (atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#titulo-pagina').textContent = estado.rota === 'fila' ? 'Acompanhamento de chamados' : 'Dashboard';
  renderTudo();
}

// =========================================================================
// Dados
// =========================================================================
async function recarregar() {
  try {
    estado.todos = ordenarFila(await api.listar() ?? []);
    renderTudo();
  } catch (e) {
    aviso(mensagemErro(e), 'erro');
  }
}

function renderTudo() {
  renderContadores();
  if (estado.rota === 'dashboard') renderDashboard();
  else renderFila().catch((e) => aviso(mensagemErro(e), 'erro'));
  if (estado.gavetaId) renderGaveta();
}

function renderContadores() {
  const r = resumo(estado.todos);
  const risco = emRisco(estado.todos).length;
  $('#nav-ativos').textContent = r.ativos || '';
  $('#nav-risco').textContent = risco || '';
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $('#subtitulo-pagina').textContent = estado.rota === 'dashboard'
    ? `Visão geral dos laboratórios · atualizado às ${hora}`
    : `${r.ativos} chamados ativos · ${risco} em risco de SLA`;
}

// =========================================================================
// DASHBOARD
// =========================================================================
function renderDashboard() {
  const lista = estado.todos;
  const r = resumo(lista);
  const risco = emRisco(lista);
  const emAtencao = risco.length - r.slaVencidos.length;
  const pct = cumprimentoSla(lista);
  const medio = tempoMedioResolucao(lista);
  const nFinal = r.porStatus.RESOLVIDO + r.porStatus.FECHADO;
  const classePct = pct === null ? 'medidor-preenchimento' : pct >= 90 ? 'medidor-ok' : pct >= 70 ? 'medidor-atencao' : 'medidor-vencido';

  $('#kpis').innerHTML = `
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-fila"/></svg>Chamados ativos</span>
      <span class="kpi-valor">${r.ativos}</span>
      <span class="kpi-detalhe">${r.porStatus.ABERTO} abertos · ${r.porStatus.EM_ATENDIMENTO} em atendimento · ${r.porStatus.PENDENTE} pendentes</span>
    </div>
    <div class="kpi ${r.slaVencidos.length ? 'kpi-critico' : ''}">
      <span class="kpi-rotulo"><svg><use href="#i-alerta"/></svg>SLA vencido</span>
      <span class="kpi-valor">${r.slaVencidos.length}</span>
      <span class="kpi-detalhe">${emAtencao} perto de vencer</span>
    </div>
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-relogio"/></svg>Cumprimento do SLA</span>
      <span class="kpi-valor">${pct === null ? '—' : `${pct}<small>%</small>`}</span>
      <div class="medidor" role="img" aria-label="${pct ?? 0}% no prazo">
        <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
          <rect class="medidor-trilho" width="100" height="4" rx="2"/>
          <rect class="medidor-preenchimento ${classePct}" width="${pct ?? 0}" height="4" rx="2"/>
        </svg>
      </div>
      <span class="kpi-detalhe">finalizados dentro do prazo</span>
    </div>
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-grid"/></svg>Tempo médio de resolução</span>
      <span class="kpi-valor">${medio === null ? '—' : duracao(medio)}</span>
      <span class="kpi-detalhe">média de ${nFinal} finalizados</span>
    </div>`;

  graficoVolume(volumeDiario(lista, 7));
  graficoNivel(r.porNivel, r.ativos);
  tabelaRisco(risco);
  barrasLabs(porLaboratorio(lista));
}

// ---------- colunas agrupadas: abertos x resolvidos por dia ----------
function caminhoBarra(x, y, w, h, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function graficoVolume(serie) {
  const caixa = $('#graf-volume');
  const W = caixa.clientWidth || 600;
  const H = caixa.clientHeight || 220;
  const m = { t: 8, r: 4, b: 28, l: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const maior = Math.max(1, ...serie.flatMap((d) => [d.abertos, d.resolvidos]));
  const passo = Math.max(1, Math.ceil(maior / 4));
  const topo = passo * 4;
  const y = (v) => m.t + ih - (v / topo) * ih;
  const gw = iw / serie.length;
  const bw = Math.min(20, gw * 0.28);

  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = passo * i;
    svg += `<line class="grade-linha" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="eixo-txt" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  serie.forEach((d, i) => {
    const cx = m.l + gw * i + gw / 2;
    const rotulo = d.dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    svg += `<text class="eixo-txt" x="${cx}" y="${H - 8}" text-anchor="middle">${rotulo} ${d.dia.getDate()}</text>`;
    if (d.abertos) svg += `<path class="col-1" d="${caminhoBarra(cx - bw - 1, y(d.abertos), bw, y(0) - y(d.abertos))}"/>`;
    if (d.resolvidos) svg += `<path class="col-2" d="${caminhoBarra(cx + 1, y(d.resolvidos), bw, y(0) - y(d.resolvidos))}"/>`;
    svg += `<rect class="alvo" data-i="${i}" x="${m.l + gw * i}" y="${m.t}" width="${gw}" height="${ih}" rx="6"/>`;
  });
  caixa.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chamados abertos e resolvidos por dia nos últimos 7 dias">${svg}</svg>`;

  caixa.querySelectorAll('.alvo').forEach((alvo) => {
    alvo.addEventListener('mousemove', (ev) => {
      const d = serie[alvo.dataset.i];
      const data = d.dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      mostrarTooltip(ev, `<strong>${data}</strong>
        <div class="tt-linha"><i class="serie-1"></i>Abertos<b>${d.abertos}</b></div>
        <div class="tt-linha"><i class="serie-2"></i>Resolvidos<b>${d.resolvidos}</b></div>`);
    });
    alvo.addEventListener('mouseleave', esconderTooltip);
  });
}

// ---------- rosca: ativos por nível de SLA ----------
function graficoNivel(porNivel, total) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 3 : 0;
  let offset = 0;
  let fatias = '';
  for (const n of NIVEIS) {
    const v = porNivel[n];
    if (!v) continue;
    const len = (v / total) * C;
    fatias += `<circle class="fatia fatia-${n}" data-n="${n}" cx="70" cy="70" r="${R}"
      stroke-dasharray="${Math.max(0, len - GAP)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
    offset += len;
  }
  const legenda = NIVEIS.map((n) => `
    <li>${icoNivel(n)}<span>${n} · ${NIVEL_LABEL[n]} <span class="sub">${SLA_HORAS[n]} h</span></span><b>${porNivel[n]}</b></li>`).join('');

  $('#graf-prioridade').innerHTML = `
    <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Chamados ativos por nível de SLA">
      <circle class="trilho" cx="70" cy="70" r="${R}"/>
      ${fatias}
      <text class="donut-centro" x="70" y="74">${total}</text>
      <text class="donut-centro-sub" x="70" y="92">ativos</text>
    </svg>
    <ul class="donut-legenda">${legenda}</ul>`;

  $$('#graf-prioridade .fatia').forEach((f) => {
    f.addEventListener('mousemove', (ev) => {
      const n = f.dataset.n;
      const v = porNivel[n];
      mostrarTooltip(ev, `<strong>${n} · ${NIVEL_LABEL[n]}</strong>
        <div class="tt-linha">${v} chamado${v > 1 ? 's' : ''}<b>${Math.round((v / total) * 100)}%</b></div>`);
    });
    f.addEventListener('mouseleave', esconderTooltip);
  });
}

// ---------- tabela "em risco de SLA" ----------
function tabelaRisco(lista) {
  if (!lista.length) {
    $('#tabela-risco').innerHTML = '<p class="vazio">Nenhum chamado em risco de SLA.</p>';
    return;
  }
  const linhas = lista.slice(0, 6).map((c) => `
    <tr data-id="${c.id}">
      <td>${icoNivel(nivel(c))}</td>
      <td><span class="codigo">${codigo(c)}</span> <span class="titulo">${esc(c.titulo)}</span></td>
      <td class="col-lab">${chipLab(c.laboratorio)}</td>
      <td class="col-status">${pilulaStatus(c.status)}</td>
      <td>${seloSla(c)}</td>
    </tr>`).join('');
  $('#tabela-risco').innerHTML = `
    <table class="mini-tabela">
      <thead><tr><th></th><th>Chamado</th><th class="col-lab">Laboratório</th><th class="col-status">Status</th><th>SLA</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

// ---------- barras: ativos por laboratório ----------
function barrasLabs(itens) {
  if (!itens.length) {
    $('#graf-labs').innerHTML = '<p class="vazio">Sem chamados ativos.</p>';
    return;
  }
  const max = Math.max(...itens.map((i) => i.total));
  $('#graf-labs').innerHTML = itens.map((i) => `
    <div class="hbarra">
      <span title="${esc(i.laboratorio)}">${esc(i.laboratorio.replace('Laboratório', 'Lab'))}</span>
      <svg class="hbarra-trilho" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="8" rx="4"/>
        <rect width="${(i.total / max) * 100}" height="8" rx="4"/>
      </svg>
      <b>${i.total}</b>
    </div>`).join('');
}

// =========================================================================
// ACOMPANHAMENTO (fila completa)
// =========================================================================
function contagemFiltro(id) {
  if (id === 'todos') return estado.todos.length;
  if (id === 'ativos') return estado.todos.filter(ativo).length;
  if (id === 'risco') return emRisco(estado.todos).length;
  return estado.todos.filter((c) => c.status === id).length;
}

async function renderFila() {
  $('#filtros').innerHTML = FILTROS.map((f) => `
    <button type="button" role="tab" data-filtro="${f.id}" aria-selected="${f.id === estado.filtro}">
      ${f.rotulo}<span class="n">${contagemFiltro(f.id)}</span>
    </button>`).join('');

  let lista;
  if (estado.filtro === 'todos') lista = estado.todos;
  else if (estado.filtro === 'ativos') lista = estado.todos.filter(ativo);
  else if (estado.filtro === 'risco') lista = emRisco(estado.todos);
  else lista = ordenarFila(await api.listar(estado.filtro) ?? []); // filtro por status na API (RF3)

  const q = estado.busca.trim().toLowerCase();
  if (q) {
    lista = lista.filter((c) =>
      `${codigo(c)} ${c.titulo} ${c.laboratorio} ${c.descricao} ${c.categoria ?? ''}`.toLowerCase().includes(q));
  }

  $('#lista-corpo').innerHTML = lista.length ? lista.map(linhaFila).join('')
    : '<p class="vazio">Nenhum chamado encontrado.</p>';
}

// Ações possíveis no status atual. Assumir um chamado ABERTO é feito na tela de
// Atendimentos (atribui o técnico); aqui só levamos o usuário até lá.
function botoesAcao(c, classe = 'btn btn-mini') {
  if (c.status === 'ABERTO') {
    return `<a class="${classe}" href="${TELA_ATENDIMENTOS}">Assumir em Atendimentos</a>`;
  }
  return proximosStatus(c.status).map((prox) => `
    <button type="button" class="${classe} ${['RESOLVIDO', 'FECHADO'].includes(prox) ? 'btn-primario' : ''}"
            data-id="${c.id}" data-prox="${prox}">${ACAO_LABEL[prox]}</button>`).join('');
}

function linhaFila(c) {
  const n = nivel(c);
  const vencida = slaEstado(c) === 'vencido';
  return `
    <div class="linha ${vencida ? 'vencida' : ''}" data-id="${c.id}" tabindex="0" role="button" aria-label="${codigo(c)} ${esc(c.titulo)}">
      <span class="pri-wrap" title="${NIVEL_LABEL[n]} · ${c.prioridade ?? ''}">${icoNivel(n)}<span class="pri-txt">${n}</span></span>
      <span class="linha-titulo">
        <span class="codigo">${codigo(c)}</span>
        <span title="${STATUS_LABEL[c.status]}">${icoStatus(c.status)}</span>
        <strong>${esc(c.titulo)}</strong>
        <span class="desc">${esc(c.descricao)}</span>
      </span>
      ${chipLab(c.laboratorio)}
      <span>${seloSla(c)}</span>
      <span class="linha-tempo" title="${formatarDataHora(c.dataAbertura)}">${tempoRelativo(c.dataAbertura)}</span>
      <span class="linha-acoes">${botoesAcao(c)}</span>
    </div>`;
}

// =========================================================================
// Mudança de status (PATCH /api/tickets/:id/status)
// =========================================================================
async function mudarStatus(id, prox) {
  if (prox === 'RESOLVIDO') return abrirResolver(id);
  try {
    await api.mudarStatus(id, prox);
    aviso(`#${id}: ${STATUS_LABEL[prox]}.`);
    await recarregar();
    if (estado.gavetaId === Number(id)) carregarHistorico(id);
  } catch (e) {
    aviso(mensagemErro(e), 'erro');
  }
}

// =========================================================================
// Painel lateral de detalhes + histórico (GET /api/tickets/:id/history)
// =========================================================================
async function carregarHistorico(id) {
  estado.historico = null;
  renderGaveta();
  try {
    const h = await api.historico(id);
    if (estado.gavetaId === Number(id)) {
      estado.historico = h ?? [];
      renderGaveta();
    }
  } catch (e) {
    if (estado.gavetaId === Number(id)) {
      estado.historico = { erro: mensagemErro(e) };
      renderGaveta();
    }
  }
}

function abrirGaveta(id) {
  estado.gavetaId = Number(id);
  $('#gaveta-fundo').hidden = false;
  const g = $('#gaveta');
  g.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => g.classList.add('aberta'));
  carregarHistorico(id);
  setTimeout(() => g.querySelector('.btn-icone')?.focus(), 50);
}

function fecharGaveta() {
  estado.gavetaId = null;
  estado.historico = null;
  const g = $('#gaveta');
  g.classList.remove('aberta');
  g.setAttribute('aria-hidden', 'true');
  $('#gaveta-fundo').hidden = true;
}

function blocoHistorico(c) {
  const h = estado.historico;
  if (h === null) return '<p class="sub">Carregando histórico…</p>';
  if (h.erro) return `<p class="sub">Não foi possível carregar o histórico: ${esc(h.erro)}</p>`;
  const eventos = [...h].sort((a, b) => new Date(a.dataAlteracao) - new Date(b.dataAlteracao)).map((ev) => `
    <li class="feito">${STATUS_LABEL[ev.statusAnterior] ?? esc(ev.statusAnterior)} → <strong>${STATUS_LABEL[ev.statusNovo] ?? esc(ev.statusNovo)}</strong>
      ${ev.observacao ? `<span class="sub"> · ${esc(ev.observacao)}</span>` : ''}
      <time>${formatarDataHora(ev.dataAlteracao)}</time></li>`).join('');
  return `<ol class="linha-tempo-v">
      <li class="feito">Chamado aberto<time>${formatarDataHora(c.dataAbertura)}</time></li>
      ${eventos}
    </ol>`;
}

// Solução = observação da última passagem para RESOLVIDO (RF5)
function solucaoDoHistorico() {
  const h = Array.isArray(estado.historico) ? estado.historico : [];
  return [...h].filter((ev) => ev.statusNovo === 'RESOLVIDO' && ev.observacao)
    .sort((a, b) => new Date(b.dataAlteracao) - new Date(a.dataAlteracao))[0]?.observacao ?? null;
}

function renderGaveta() {
  const c = acharChamado(estado.gavetaId);
  if (!c) {
    fecharGaveta();
    return;
  }
  const n = nivel(c);
  const e = slaEstado(c);
  const ini = new Date(c.dataAbertura).getTime();
  const fim = prazo(c).getTime();
  const res = dataResolucao(c);
  const ref = res ? new Date(res).getTime() : Date.now();
  const pct = Math.min(100, Math.max(2, ((ref - ini) / (fim - ini)) * 100));
  const textoSla = e === 'finalizado'
    ? (res && new Date(res).getTime() <= fim ? 'Resolvido dentro do prazo' : 'Resolvido fora do prazo')
    : ESTADO_SLA_LABEL[e];
  const solucao = c.solucao ?? solucaoDoHistorico();

  $('#gaveta').innerHTML = `
    <div class="gaveta-topo">
      <span class="codigo">Chamado ${codigo(c)}</span>
      <button type="button" class="btn-icone" data-fechar-gaveta aria-label="Fechar"><svg><use href="#i-fechar"/></svg></button>
    </div>
    <div class="gaveta-corpo">
      <h2 id="gaveta-titulo">${esc(c.titulo)}</h2>
      <div class="gaveta-tags">${pilulaStatus(c.status)}<span class="pilula">${icoNivel(n)}${n} · ${NIVEL_LABEL[n]}</span>${chipLab(c.laboratorio)}</div>

      <div class="bloco-sla">
        <div class="bloco-sla-topo"><strong>${textoSla}</strong>${seloSla(c)}</div>
        <svg class="progresso" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
          <rect class="progresso-trilho" width="100" height="6" rx="3"/>
          <rect class="prog-${e}" width="${pct}" height="6" rx="3"/>
        </svg>
        <span class="sub">Prazo ${formatarDataHora(prazoIso(c))} · ${n} = ${SLA_HORAS[n]} h</span>
      </div>

      <dl class="props">
        <dt>Categoria</dt><dd>${esc(c.categoria ?? '—')}</dd>
        <dt>Prioridade</dt><dd>${esc(c.prioridade ?? '—')}</dd>
        <dt>Técnico</dt><dd>${esc(c.tecnicoNome ?? (c.tecnicoId ? `#${c.tecnicoId}` : 'Ainda não atribuído'))}</dd>
        <dt>Aberto em</dt><dd>${formatarDataHora(c.dataAbertura)} (${tempoRelativo(c.dataAbertura)})</dd>
        <dt>Prazo (SLA)</dt><dd>${formatarDataHora(prazoIso(c))}</dd>
        <dt>Resolvido em</dt><dd>${formatarDataHora(res)}</dd>
      </dl>

      <div class="secao-txt"><h3>Descrição</h3><p>${esc(c.descricao)}</p></div>
      ${solucao ? `<div class="secao-txt"><h3>Solução aplicada</h3><p class="solucao-box">${esc(solucao)}</p></div>` : ''}

      <div class="secao-txt"><h3>Histórico</h3>${blocoHistorico(c)}</div>
    </div>
    ${botoesAcao(c, 'btn') ? `<div class="gaveta-acoes">${botoesAcao(c, 'btn')}</div>` : ''}`;
}

// =========================================================================
// Resolver (RF5 — solução obrigatória, enviada como "observacao")
// =========================================================================
function abrirResolver(id) {
  const c = acharChamado(id);
  estado.resolvendoId = Number(id);
  $('#dlg-id').textContent = `#${id}`;
  $('#dlg-titulo').textContent = c?.titulo ?? '';
  $('#f-solucao').value = '';
  $('#dlg-erro').hidden = true;
  $('#dlg-resolver').showModal();
  $('#f-solucao').focus();
}

async function confirmarResolver(ev) {
  ev.preventDefault();
  const solucao = $('#f-solucao').value;
  if (!solucao.trim()) {
    $('#dlg-erro').textContent = 'Descreva a solução aplicada antes de resolver.';
    $('#dlg-erro').hidden = false;
    return;
  }
  try {
    await api.mudarStatus(estado.resolvendoId, 'RESOLVIDO', solucao);
    $('#dlg-resolver').close();
    aviso(`#${estado.resolvendoId} resolvido.`);
    await recarregar();
    if (estado.gavetaId === estado.resolvendoId) carregarHistorico(estado.resolvendoId);
  } catch (e) {
    $('#dlg-erro').textContent = mensagemErro(e);
    $('#dlg-erro').hidden = false;
  }
}

// =========================================================================
// Paleta de comandos (⌘K / Ctrl+K)
// =========================================================================
const COMANDOS = [
  { rotulo: 'Abrir novo chamado', icone: 'i-mais', atalho: 'C', executar: () => { location.href = TELA_ABERTURA; } },
  { rotulo: 'Ir para o Dashboard', icone: 'i-grid', atalho: 'G D', executar: () => { location.hash = '#dashboard'; } },
  { rotulo: 'Ir para o Acompanhamento', icone: 'i-fila', atalho: 'G F', executar: () => { location.hash = '#fila'; } },
  { rotulo: 'Ver chamados com SLA em risco', icone: 'i-alerta', executar: () => { location.hash = '#fila/risco'; } },
  { rotulo: 'Ir para a tela de Atendimentos', icone: 'i-usuario', executar: () => { location.href = TELA_ATENDIMENTOS; } },
];
let itensPaleta = [];
let selecionado = 0;

function abrirPaleta() {
  if ($('#dlg-paleta').open) return;
  $('#paleta-input').value = '';
  selecionado = 0;
  renderPaleta();
  $('#dlg-paleta').showModal();
  $('#paleta-input').focus();
}

function renderPaleta() {
  const q = $('#paleta-input').value.trim().toLowerCase();
  const cmds = COMANDOS.filter((c) => c.rotulo.toLowerCase().includes(q));
  const chamados = q
    ? estado.todos.filter((c) => `${codigo(c)} ${c.titulo} ${c.laboratorio}`.toLowerCase().includes(q)).slice(0, 8)
    : emRisco(estado.todos).slice(0, 4);

  itensPaleta = [
    ...cmds.map((c) => ({ ...c })),
    ...chamados.map((c) => ({ executar: () => abrirGaveta(c.id) })),
  ];
  selecionado = Math.min(selecionado, Math.max(0, itensPaleta.length - 1));

  let html = '';
  let i = 0;
  if (cmds.length) {
    html += '<li class="paleta-grupo">Comandos</li>';
    for (const c of cmds) {
      html += `<li class="paleta-item" role="option" data-i="${i}" aria-selected="${i === selecionado}">
        <svg><use href="#${c.icone}"/></svg>${c.rotulo}${c.atalho ? `<span class="dir"><kbd>${c.atalho}</kbd></span>` : ''}</li>`;
      i++;
    }
  }
  if (chamados.length) {
    html += `<li class="paleta-grupo">${q ? 'Chamados' : 'Precisam de atenção'}</li>`;
    for (const c of chamados) {
      html += `<li class="paleta-item" role="option" data-i="${i}" aria-selected="${i === selecionado}">
        ${icoNivel(nivel(c))}<span class="codigo">${codigo(c)}</span>${esc(c.titulo)}<span class="dir">${seloSla(c)}</span></li>`;
      i++;
    }
  }
  $('#paleta-lista').innerHTML = html || '<li class="vazio">Nada encontrado.</li>';
}

function executarItemPaleta(i) {
  const item = itensPaleta[i];
  if (!item) return;
  $('#dlg-paleta').close();
  item.executar();
}

// =========================================================================
// Atalhos de teclado (C, G D, G F, /, ⌘K, Esc)
// =========================================================================
let esperaG = 0;
function atalhos(ev) {
  const dialogoAberto = $$('dialog').some((d) => d.open);
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
    ev.preventDefault();
    if (!dialogoAberto) abrirPaleta();
    return;
  }
  if (ev.key === 'Escape' && estado.gavetaId && !dialogoAberto) {
    fecharGaveta();
    return;
  }
  const digitando = ev.target.closest('input, textarea, select, [contenteditable]');
  if (dialogoAberto || digitando || ev.metaKey || ev.ctrlKey || ev.altKey) return;

  const k = ev.key.toLowerCase();
  if (Date.now() - esperaG < 900) {
    esperaG = 0;
    if (k === 'd') {
      location.hash = '#dashboard';
      return;
    }
    if (k === 'f') {
      location.hash = '#fila';
      return;
    }
  }
  if (k === 'g') {
    esperaG = Date.now();
    return;
  }
  if (k === 'c') {
    location.href = TELA_ABERTURA;
    return;
  }
  if (k === '/') {
    ev.preventDefault();
    abrirPaleta();
  }
}

// =========================================================================
// Inicialização
// =========================================================================
function iniciar() {
  // Conta conectada no menu compartilhado (js/layout.js), como nas demais telas.
  window.HelpDeskAuth?.requireUser()
    .then((usuario) => window.HelpDeskAuth.navigation(usuario))
    .catch(() => { /* sem sessão: o cliente de autenticação redireciona para o login */ });

  if (CONFIG.USE_MOCK) {
    $('#modo-demo').hidden = false;
    $('#btn-restaurar').addEventListener('click', async () => {
      await api.restaurar();
      aviso('Dados de exemplo restaurados.');
      recarregar();
    });
  }

  document.addEventListener('click', (ev) => {
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'paleta') abrirPaleta();

    const btn = ev.target.closest('button[data-prox]');
    if (btn) {
      ev.stopPropagation();
      mudarStatus(btn.dataset.id, btn.dataset.prox);
      return;
    }
    if (ev.target.closest('.linha-acoes a')) return; // link para Atendimentos

    const linha = ev.target.closest('.linha[data-id], .mini-tabela tr[data-id]');
    if (linha) abrirGaveta(linha.dataset.id);

    if (ev.target.closest('[data-fechar-gaveta]') || ev.target.id === 'gaveta-fundo') fecharGaveta();
    if (ev.target.closest('[data-fechar]')) ev.target.closest('dialog').close();

    const filtro = ev.target.closest('[data-filtro]');
    if (filtro) location.hash = filtro.dataset.filtro === 'ativos' ? '#fila' : `#fila/${filtro.dataset.filtro}`;

    const itemPaleta = ev.target.closest('.paleta-item');
    if (itemPaleta) executarItemPaleta(Number(itemPaleta.dataset.i));
  });

  $('#lista-corpo').addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.linha')) {
      ev.preventDefault();
      abrirGaveta(ev.target.dataset.id);
    }
  });

  $('#busca-fila').addEventListener('input', (ev) => {
    estado.busca = ev.target.value;
    renderFila();
  });
  $('#form-resolver').addEventListener('submit', confirmarResolver);

  $('#paleta-input').addEventListener('input', () => {
    selecionado = 0;
    renderPaleta();
  });
  $('#paleta-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      selecionado = Math.min(selecionado + 1, itensPaleta.length - 1);
      renderPaleta();
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      selecionado = Math.max(selecionado - 1, 0);
      renderPaleta();
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      executarItemPaleta(selecionado);
    }
  });
  $('#dlg-paleta').addEventListener('click', (ev) => {
    if (ev.target.id === 'dlg-paleta') ev.target.close();
  });

  // Outra aba (abertura/atendimentos) mudou os dados de demonstração → atualiza
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'helpdesk_chamados') recarregar();
  });

  document.addEventListener('keydown', atalhos);
  window.addEventListener('hashchange', aplicarRota);
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (estado.rota === 'dashboard') renderDashboard();
    }, 150);
  });

  aplicarRota();
  recarregar();
  setInterval(recarregar, CONFIG.ATUALIZAR_A_CADA_MS);
}

iniciar();
