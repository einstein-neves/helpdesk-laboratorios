// Controlador da interface: navegação, dashboard, fila, painel de detalhes,
// formulário, paleta de comandos (⌘K) e atalhos de teclado.
import { CONFIG } from './config.js';
import { criarCliente } from './api.js';
import {
  ACAO_LABEL, PRIORIDADES, SLA_HORAS, STATUS, STATUS_LABEL,
  calcularPrazo, codigo, cumprimentoSla, duracao, emRisco, formatarDataHora,
  porLaboratorio, proximosStatus, resumo, slaCurto, slaEstado, tempoMedioResolucao,
  tempoRelativo, validarNovoChamado, volumeDiario,
} from './regras-ui.js';

const api = criarCliente(CONFIG);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const PRIORIDADE_LABEL = { P1: 'Crítica', P2: 'Alta', P3: 'Média', P4: 'Baixa' };
const ESTADO_SLA_LABEL = { ok: 'No prazo', atencao: 'Perto de vencer', vencido: 'SLA vencido', finalizado: 'Finalizado' };
const FILTROS = [
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'todos', rotulo: 'Todos' },
  ...STATUS.map((s) => ({ id: s, rotulo: STATUS_LABEL[s] })),
  { id: 'risco', rotulo: 'SLA em risco' },
];

const estado = {
  todos: [],         // todos os chamados (dashboard e contadores)
  rota: 'dashboard',
  filtro: 'ativos',
  busca: '',
  gavetaId: null,    // chamado aberto no painel lateral
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
  if (e.status === 404) return 'Chamado não encontrado (404).';
  return e.message || 'Erro inesperado.';
}

const ativo = (c) => c.status === 'aberto' || c.status === 'em_atendimento';
const acharChamado = (id) => estado.todos.find((c) => c.id === Number(id));

// ---------- ícones ----------
// Prioridade no estilo "sinal" (P1 = alerta cheio; P2..P4 = 3, 2 e 1 barras)
function icoPri(p) {
  if (p === 'P1') {
    return `<svg class="ico-pri P1" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5"/><path d="M8 4.4v4.8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.8" r="1.15" fill="#fff"/></svg>`;
  }
  const ligadas = { P2: 3, P3: 2, P4: 1 }[p] ?? 0;
  const barras = [5, 8, 11].map((h, i) =>
    `<rect class="${i < ligadas ? 'on' : 'off'}" x="${1.5 + i * 5}" y="${14 - h}" width="3" height="${h}" rx="1"/>`).join('');
  return `<svg class="ico-pri" viewBox="0 0 16 16" aria-hidden="true">${barras}</svg>`;
}

function icoStatus(s) {
  const base = `<svg class="ico-status st-${s}" viewBox="0 0 14 14" aria-hidden="true">`;
  if (s === 'aberto') return `${base}<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  if (s === 'em_atendimento') return `${base}<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z"/></svg>`;
  return `${base}<circle cx="7" cy="7" r="6.3"/><path d="m4.4 7.2 1.8 1.8 3.4-3.6" fill="none" style="stroke:var(--superficie)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const pilulaStatus = (s) => `<span class="pilula">${icoStatus(s)}${STATUS_LABEL[s] ?? esc(s)}</span>`;
const priCompleta = (p) => `<span class="pri-wrap">${icoPri(p)}<span class="pri-txt">${esc(p)}</span></span>`;
const chipLab = (l) => `<span class="chip-lab"><svg><use href="#i-monitor"/></svg>${esc(l)}</span>`;

// Selo de SLA no padrão Zendesk: verde (no prazo), âmbar (perto), vermelho (vencido, negativo)
function seloSla(c) {
  const e = slaEstado(c);
  if (e === 'finalizado') return '<span class="sla sla-finalizado">—</span>';
  const titulo = `${ESTADO_SLA_LABEL[e]} · prazo ${formatarDataHora(c.prazo_sla)}`;
  return `<span class="sla sla-${e}" title="${titulo}" aria-label="${titulo}"><svg><use href="#i-relogio"/></svg>${slaCurto(c)}</span>`;
}

// ---------- tooltip compartilhado pelos gráficos ----------
const tooltip = $('#tooltip');
function mostrarTooltip(ev, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const { innerWidth: w } = window;
  const r = tooltip.getBoundingClientRect();
  let x = ev.clientX + 14;
  if (x + r.width > w - 8) x = ev.clientX - r.width - 14;
  tooltip.style.left = `${Math.max(8, x)}px`;
  tooltip.style.top = `${Math.max(8, ev.clientY - r.height - 10)}px`;
}
const esconderTooltip = () => { tooltip.hidden = true; };

// =========================================================================
// Navegação (#dashboard, #fila, #fila/<filtro>, #novo)
// =========================================================================
function aplicarRota() {
  const [rota, filtro] = (location.hash.slice(1) || 'dashboard').split('/');
  if (rota === 'novo') { abrirNovo(); history.replaceState(null, '', `#${estado.rota}`); return; }
  estado.rota = rota === 'fila' ? 'fila' : 'dashboard';
  if (estado.rota === 'fila') estado.filtro = FILTROS.some((f) => f.id === filtro) ? filtro : 'ativos';

  $$('[data-secao]').forEach((s) => { s.hidden = s.dataset.secao !== estado.rota; });
  const chaveMenu = estado.rota === 'fila' && estado.filtro === 'risco' ? 'fila/risco' : estado.rota;
  $$('[data-rota]').forEach((a) => {
    const ativo = a.dataset.rota === chaveMenu;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#titulo-pagina').textContent = estado.rota === 'fila' ? 'Fila de atendimento' : 'Dashboard';
  renderTudo();
}

// =========================================================================
// Dados
// =========================================================================
async function recarregar() {
  try {
    estado.todos = await api.listar();
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
  const nFinal = r.porStatus.resolvido + r.porStatus.fechado;
  const corPct = pct === null ? 'var(--texto-3)' : pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--atencao)' : 'var(--vencido)';

  $('#kpis').innerHTML = `
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-fila"/></svg>Chamados ativos</span>
      <span class="kpi-valor">${r.ativos}</span>
      <span class="kpi-detalhe">${r.porStatus.aberto} abertos · ${r.porStatus.em_atendimento} em atendimento</span>
    </div>
    <div class="kpi ${r.slaVencidos.length ? 'kpi-critico' : ''}">
      <span class="kpi-rotulo"><svg><use href="#i-alerta"/></svg>SLA vencido</span>
      <span class="kpi-valor">${r.slaVencidos.length}</span>
      <span class="kpi-detalhe">${emAtencao} perto de vencer</span>
    </div>
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-relogio"/></svg>Cumprimento do SLA</span>
      <span class="kpi-valor">${pct === null ? '—' : `${pct}<small>%</small>`}</span>
      <div class="medidor" role="img" aria-label="${pct ?? 0}% no prazo"><span style="width:${pct ?? 0}%;background:${corPct}"></span></div>
      <span class="kpi-detalhe">finalizados dentro do prazo</span>
    </div>
    <div class="kpi">
      <span class="kpi-rotulo"><svg><use href="#i-grid"/></svg>Tempo médio de resolução</span>
      <span class="kpi-valor">${medio === null ? '—' : duracao(medio)}</span>
      <span class="kpi-detalhe">média de ${nFinal} finalizados</span>
    </div>`;

  graficoVolume(volumeDiario(lista, 7));
  graficoPrioridade(r.porPrioridade, r.ativos);
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

// ---------- rosca: ativos por prioridade ----------
function graficoPrioridade(porPrioridade, total) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 3 : 0;
  let offset = 0;
  let fatias = '';
  for (const p of PRIORIDADES) {
    const v = porPrioridade[p];
    if (!v) continue;
    const len = (v / total) * C;
    fatias += `<circle class="fatia" data-p="${p}" cx="70" cy="70" r="${R}" style="stroke:var(--${p.toLowerCase()})"
      stroke-dasharray="${Math.max(0, len - GAP)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
    offset += len;
  }
  const legenda = PRIORIDADES.map((p) => `
    <li>${icoPri(p)}<span>${p} · ${PRIORIDADE_LABEL[p]} <span class="sub">${SLA_HORAS[p]} h</span></span><b>${porPrioridade[p]}</b></li>`).join('');

  $('#graf-prioridade').innerHTML = `
    <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Chamados ativos por prioridade">
      <circle class="trilho" cx="70" cy="70" r="${R}"/>
      ${fatias}
      <text class="donut-centro" x="70" y="74">${total}</text>
      <text class="donut-centro-sub" x="70" y="92">ativos</text>
    </svg>
    <ul class="donut-legenda">${legenda}</ul>`;

  $$('#graf-prioridade .fatia').forEach((f) => {
    f.addEventListener('mousemove', (ev) => {
      const p = f.dataset.p;
      const v = porPrioridade[p];
      mostrarTooltip(ev, `<strong>${p} · ${PRIORIDADE_LABEL[p]}</strong>
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
      <td>${icoPri(c.prioridade)}</td>
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
  if (!itens.length) { $('#graf-labs').innerHTML = '<p class="vazio">Sem chamados ativos.</p>'; return; }
  const max = Math.max(...itens.map((i) => i.total));
  $('#graf-labs').innerHTML = itens.map((i) => `
    <div class="hbarra">
      <span>${esc(i.laboratorio)}</span>
      <span class="hbarra-trilho"><span style="width:${(i.total / max) * 100}%"></span></span>
      <b>${i.total}</b>
    </div>`).join('');
}

// =========================================================================
// FILA
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
  if (estado.filtro === 'todos') lista = estado.todos;              // API já devolve ordenado (RF3)
  else if (estado.filtro === 'ativos') lista = estado.todos.filter(ativo);
  else if (estado.filtro === 'risco') lista = emRisco(estado.todos);
  else lista = await api.listar(estado.filtro);                      // filtro por status na API (RF3)

  const q = estado.busca.trim().toLowerCase();
  if (q) {
    lista = lista.filter((c) => `${codigo(c)} ${c.titulo} ${c.laboratorio} ${c.descricao}`.toLowerCase().includes(q));
  }

  $('#lista-corpo').innerHTML = lista.length ? lista.map(linhaFila).join('')
    : '<p class="vazio">Nenhum chamado encontrado.</p>';
}

function botoesAcao(c, classe = 'btn btn-mini') {
  return proximosStatus(c.status).map((prox) => `
    <button type="button" class="${classe} ${prox === 'aberto' ? '' : 'btn-primario'}" data-id="${c.id}" data-prox="${prox}">${ACAO_LABEL[prox]}</button>`).join('');
}

function linhaFila(c) {
  const vencida = slaEstado(c) === 'vencido';
  return `
    <div class="linha ${vencida ? 'vencida' : ''}" data-id="${c.id}" tabindex="0" role="button" aria-label="${codigo(c)} ${esc(c.titulo)}">
      <span class="pri-wrap">${icoPri(c.prioridade)}<span class="pri-txt">${c.prioridade}</span></span>
      <span class="linha-titulo">
        <span class="codigo">${codigo(c)}</span>
        <span title="${STATUS_LABEL[c.status]}">${icoStatus(c.status)}</span>
        <strong>${esc(c.titulo)}</strong>
        <span class="desc">${esc(c.descricao)}</span>
      </span>
      ${chipLab(c.laboratorio)}
      <span>${seloSla(c)}</span>
      <span class="linha-tempo" title="${formatarDataHora(c.aberto_em)}">${tempoRelativo(c.aberto_em)}</span>
      <span class="linha-acoes">${botoesAcao(c)}</span>
    </div>`;
}

// =========================================================================
// Mudança de status
// =========================================================================
async function mudarStatus(id, prox) {
  if (prox === 'resolvido') return abrirResolver(id);
  try {
    await api.mudarStatus(id, prox);
    aviso(`HD-${id}: ${STATUS_LABEL[prox]}.`);
    await recarregar();
  } catch (e) {
    aviso(mensagemErro(e), 'erro');
  }
}

// =========================================================================
// Painel lateral de detalhes
// =========================================================================
function abrirGaveta(id) {
  estado.gavetaId = Number(id);
  renderGaveta();
  $('#gaveta-fundo').hidden = false;
  const g = $('#gaveta');
  g.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => g.classList.add('aberta'));
  setTimeout(() => g.querySelector('.btn-icone')?.focus(), 50);
}

function fecharGaveta() {
  estado.gavetaId = null;
  const g = $('#gaveta');
  g.classList.remove('aberta');
  g.setAttribute('aria-hidden', 'true');
  $('#gaveta-fundo').hidden = true;
}

function renderGaveta() {
  const c = acharChamado(estado.gavetaId);
  if (!c) { fecharGaveta(); return; }
  const e = slaEstado(c);
  const ini = new Date(c.aberto_em).getTime();
  const fim = new Date(c.prazo_sla).getTime();
  const ref = c.resolvido_em ? new Date(c.resolvido_em).getTime() : Date.now();
  const pct = Math.min(100, Math.max(2, ((ref - ini) / (fim - ini)) * 100));
  const textoSla = e === 'finalizado'
    ? (new Date(c.resolvido_em) <= new Date(c.prazo_sla) ? 'Resolvido dentro do prazo' : 'Resolvido fora do prazo')
    : ESTADO_SLA_LABEL[e];

  const eventos = [
    { rotulo: 'Chamado aberto', quando: c.aberto_em, feito: true },
    { rotulo: 'Em atendimento', quando: null, feito: c.status !== 'aberto' },
    { rotulo: 'Resolvido', quando: c.resolvido_em, feito: Boolean(c.resolvido_em) },
    { rotulo: 'Fechado', quando: null, feito: c.status === 'fechado' },
  ];

  $('#gaveta').innerHTML = `
    <div class="gaveta-topo">
      <span class="codigo">${codigo(c)}</span>
      <button type="button" class="btn-icone" data-fechar-gaveta aria-label="Fechar"><svg><use href="#i-fechar"/></svg></button>
    </div>
    <div class="gaveta-corpo">
      <h2 id="gaveta-titulo">${esc(c.titulo)}</h2>
      <div class="gaveta-tags">${pilulaStatus(c.status)}<span class="pilula">${icoPri(c.prioridade)}${c.prioridade} · ${PRIORIDADE_LABEL[c.prioridade]}</span>${chipLab(c.laboratorio)}</div>

      <div class="bloco-sla">
        <div class="bloco-sla-topo"><strong>${textoSla}</strong>${seloSla(c)}</div>
        <div class="progresso"><span class="prog-${e}" style="width:${pct}%"></span></div>
        <span class="sub">Prazo ${formatarDataHora(c.prazo_sla)} · ${c.prioridade} = ${SLA_HORAS[c.prioridade]} h</span>
      </div>

      <dl class="props">
        <dt>Aberto em</dt><dd>${formatarDataHora(c.aberto_em)} (${tempoRelativo(c.aberto_em)})</dd>
        <dt>Prazo (SLA)</dt><dd>${formatarDataHora(c.prazo_sla)}</dd>
        <dt>Resolvido em</dt><dd>${formatarDataHora(c.resolvido_em)}</dd>
      </dl>

      <div class="secao-txt"><h3>Descrição</h3><p>${esc(c.descricao)}</p></div>
      ${c.solucao ? `<div class="secao-txt"><h3>Solução aplicada</h3><p class="solucao-box">${esc(c.solucao)}</p></div>` : ''}

      <div class="secao-txt">
        <h3>Andamento</h3>
        <ol class="linha-tempo-v">
          ${eventos.map((ev) => `<li class="${ev.feito ? 'feito' : ''}">${ev.rotulo}${ev.quando ? `<time>${formatarDataHora(ev.quando)}</time>` : ''}</li>`).join('')}
        </ol>
      </div>
    </div>
    ${proximosStatus(c.status).length ? `<div class="gaveta-acoes">${botoesAcao(c, 'btn')}</div>` : ''}`;
}

// =========================================================================
// Resolver (RF5 — solução obrigatória)
// =========================================================================
function abrirResolver(id) {
  const c = acharChamado(id);
  estado.resolvendoId = Number(id);
  $('#dlg-id').textContent = `HD-${id}`;
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
    await api.mudarStatus(estado.resolvendoId, 'resolvido', solucao);
    $('#dlg-resolver').close();
    aviso(`HD-${estado.resolvendoId} resolvido.`);
    await recarregar();
  } catch (e) {
    $('#dlg-erro').textContent = mensagemErro(e);
    $('#dlg-erro').hidden = false;
  }
}

// =========================================================================
// Novo chamado
// =========================================================================
function montarEscolhaPrioridade() {
  $('#escolha-prioridade').innerHTML = PRIORIDADES.map((p) => `
    <label>
      <input type="radio" name="prioridade" value="${p}" ${p === 'P3' ? 'checked' : ''}>
      <strong>${icoPri(p)} ${p}</strong>
      <span>${PRIORIDADE_LABEL[p]} · ${SLA_HORAS[p]} h</span>
    </label>`).join('');
}

function dadosFormulario() {
  const f = $('#form-novo');
  return {
    titulo: f.titulo.value,
    descricao: f.descricao.value,
    laboratorio: f.laboratorio.value,
    prioridade: f.querySelector('input[name=prioridade]:checked')?.value,
  };
}

function atualizarPrevia() {
  const { prioridade } = dadosFormulario();
  if (!prioridade) return;
  const prazo = calcularPrazo(new Date(), prioridade);
  $('#previa-prazo').innerHTML = `<svg><use href="#i-relogio"/></svg>
    <span>Se abrir agora, o prazo será <strong>${formatarDataHora(prazo.toISOString())}</strong> (${SLA_HORAS[prioridade]} h).</span>`;
}

function abrirNovo() {
  if ($('#dlg-novo').open) return;
  $('#form-novo').reset();
  $('#erros-form').hidden = true;
  atualizarPrevia();
  $('#dlg-novo').showModal();
  $('#f-titulo').focus();
}

async function enviarNovo(ev) {
  ev.preventDefault();
  const dados = dadosFormulario();
  const erros = validarNovoChamado(dados);
  const ul = $('#erros-form');
  ul.hidden = erros.length === 0;
  ul.innerHTML = erros.map((e) => `<li>${esc(e)}</li>`).join('');
  if (erros.length) return;
  try {
    const c = await api.criar(dados);
    $('#dlg-novo').close();
    aviso(`${codigo(c)} aberto · prazo ${formatarDataHora(c.prazo_sla)}.`);
    await recarregar();
    if (estado.rota !== 'fila') location.hash = '#fila';
    abrirGaveta(c.id);
  } catch (e) {
    ul.hidden = false;
    ul.innerHTML = `<li>${esc(mensagemErro(e))}</li>`;
  }
}

// =========================================================================
// Paleta de comandos (⌘K / Ctrl+K)
// =========================================================================
const COMANDOS = [
  { rotulo: 'Novo chamado', icone: 'i-mais', atalho: 'C', executar: abrirNovo },
  { rotulo: 'Ir para o Dashboard', icone: 'i-grid', atalho: 'G D', executar: () => { location.hash = '#dashboard'; } },
  { rotulo: 'Ir para a Fila de atendimento', icone: 'i-fila', atalho: 'G F', executar: () => { location.hash = '#fila'; } },
  { rotulo: 'Ver chamados com SLA em risco', icone: 'i-alerta', executar: () => { location.hash = '#fila/risco'; } },
  { rotulo: 'Alternar tema claro/escuro', icone: 'i-lua', executar: alternarTema },
];
let itensPaleta = [];
let selecionado = 0;

function abrirPaleta() {
  if ($('#dlg-paleta').open) return;
  $('#paleta-input').value = '';
  renderPaleta();
  $('#dlg-paleta').showModal();
  $('#paleta-input').focus();
}

function renderPaleta() {
  const q = $('#paleta-input').value.trim().toLowerCase();
  const cmds = COMANDOS.filter((c) => c.rotulo.toLowerCase().includes(q));
  const chamados = q
    ? estado.todos.filter((c) => `${codigo(c)} ${c.titulo} ${c.laboratorio}`.toLowerCase().includes(q)).slice(0, 8)
    : estado.todos.filter((c) => ['vencido', 'atencao'].includes(slaEstado(c))).slice(0, 4);

  itensPaleta = [
    ...cmds.map((c) => ({ tipo: 'cmd', ...c })),
    ...chamados.map((c) => ({ tipo: 'chamado', chamado: c, executar: () => abrirGaveta(c.id) })),
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
        ${icoPri(c.prioridade)}<span class="codigo">${codigo(c)}</span>${esc(c.titulo)}<span class="dir">${seloSla(c)}</span></li>`;
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
// Tema
// =========================================================================
function alternarTema() {
  const raiz = document.documentElement;
  const escuroAtual = raiz.dataset.theme
    ? raiz.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  raiz.dataset.theme = escuroAtual ? 'light' : 'dark';
  try { localStorage.setItem('helpdesk-tema', raiz.dataset.theme); } catch { /* sem armazenamento */ }
  if (estado.rota === 'dashboard') renderDashboard();
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
  if (ev.key === 'Escape' && estado.gavetaId && !dialogoAberto) { fecharGaveta(); return; }
  const digitando = ev.target.closest('input, textarea, select, [contenteditable]');
  if (dialogoAberto || digitando || ev.metaKey || ev.ctrlKey || ev.altKey) return;

  const k = ev.key.toLowerCase();
  if (Date.now() - esperaG < 900) {
    esperaG = 0;
    if (k === 'd') { location.hash = '#dashboard'; return; }
    if (k === 'f') { location.hash = '#fila'; return; }
  }
  if (k === 'g') { esperaG = Date.now(); return; }
  if (k === 'c') { ev.preventDefault(); abrirNovo(); return; }
  if (k === '/') { ev.preventDefault(); abrirPaleta(); }
}

// =========================================================================
// Inicialização
// =========================================================================
function iniciar() {
  montarEscolhaPrioridade();

  if (CONFIG.USE_MOCK) {
    $('#modo-demo').hidden = false;
    $('#btn-restaurar').addEventListener('click', async () => {
      await api.restaurar();
      aviso('Dados de exemplo restaurados.');
      recarregar();
    });
  }

  // ações genéricas (data-acao)
  document.addEventListener('click', (ev) => {
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'novo') abrirNovo();
    if (acao === 'paleta') abrirPaleta();
    if (acao === 'tema') alternarTema();

    const btn = ev.target.closest('button[data-prox]');
    if (btn) { ev.stopPropagation(); mudarStatus(btn.dataset.id, btn.dataset.prox); return; }

    const linha = ev.target.closest('.linha[data-id], .mini-tabela tr[data-id]');
    if (linha) abrirGaveta(linha.dataset.id);

    if (ev.target.closest('[data-fechar-gaveta]') || ev.target.id === 'gaveta-fundo') fecharGaveta();
    if (ev.target.closest('[data-fechar]')) ev.target.closest('dialog').close();

    const filtro = ev.target.closest('[data-filtro]');
    if (filtro) location.hash = filtro.dataset.filtro === 'ativos' ? '#fila' : `#fila/${filtro.dataset.filtro}`;

    const itemPaleta = ev.target.closest('.paleta-item');
    if (itemPaleta) executarItemPaleta(Number(itemPaleta.dataset.i));
  });

  // Enter/Espaço abrem a linha da fila pelo teclado
  $('#lista-corpo').addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.linha')) {
      ev.preventDefault();
      abrirGaveta(ev.target.dataset.id);
    }
  });

  $('#busca-fila').addEventListener('input', (ev) => { estado.busca = ev.target.value; renderFila(); });
  $('#form-novo').addEventListener('submit', enviarNovo);
  $('#form-novo').addEventListener('change', atualizarPrevia);
  $('#form-resolver').addEventListener('submit', confirmarResolver);

  $('#paleta-input').addEventListener('input', () => { selecionado = 0; renderPaleta(); });
  $('#paleta-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); selecionado = Math.min(selecionado + 1, itensPaleta.length - 1); renderPaleta(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); selecionado = Math.max(selecionado - 1, 0); renderPaleta(); }
    if (ev.key === 'Enter') { ev.preventDefault(); executarItemPaleta(selecionado); }
  });
  // clicar fora da paleta fecha
  $('#dlg-paleta').addEventListener('click', (ev) => { if (ev.target.id === 'dlg-paleta') ev.target.close(); });

  document.addEventListener('keydown', atalhos);
  window.addEventListener('hashchange', aplicarRota);
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (estado.rota === 'dashboard') renderDashboard(); }, 150);
  });

  aplicarRota();
  recarregar();
  setInterval(recarregar, CONFIG.ATUALIZAR_A_CADA_MS);
}

iniciar();
