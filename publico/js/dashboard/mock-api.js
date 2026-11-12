// API FALSA (mock) do dashboard, usada só com dashboard.html?mock=1 e nos testes.
// - Guarda dados de exemplo no navegador (localStorage "helpdesk_chamados");
//   eles são separados dos chamados reais, que vêm da API.
// - Segue o contrato da equipe e devolve os mesmos códigos de erro do backend,
//   por isso a suíte de testes de contrato roda contra ela e contra a API real.

import { ApiErro } from './api-erro.js';
import {
  PRIORIDADE_DO_NIVEL, STATUS, TRANSICOES, calcularPrazo, ordenarFila, validarNovoChamado,
} from './regras-ui.js';

const CHAVE_CHAMADOS = 'helpdesk_chamados';
const CHAVE_HISTORICO = 'helpdesk_historico';
const HORA = 60 * 60 * 1000;
const USUARIO_ATUAL = 6; // usuário simulado do mock

// Técnicos simulados
const TECNICOS = { 4: 'Hilccer', 5: 'Matheus', 6: 'Guilherme' };

function armazenamentoPadrao() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('__teste__', '1');
    ls.removeItem('__teste__');
    const ler = (k) => { try { return JSON.parse(ls.getItem(k) ?? 'null'); } catch { return null; } };
    return {
      ler: () => ler(CHAVE_CHAMADOS),
      salvar: (d) => ls.setItem(CHAVE_CHAMADOS, JSON.stringify(d)),
      lerHistorico: () => ler(CHAVE_HISTORICO),
      salvarHistorico: (d) => ls.setItem(CHAVE_HISTORICO, JSON.stringify(d)),
    };
  } catch {
    return armazenamentoEmMemoria(); // Node (testes) ou navegador sem localStorage
  }
}

export function armazenamentoEmMemoria() {
  let chamados = null;
  let historico = null;
  return {
    ler: () => chamados, salvar: (d) => { chamados = d; },
    lerHistorico: () => historico, salvarHistorico: (d) => { historico = d; },
  };
}

// ---------------------------------------------------------------------------
// Dados de exemplo (uma semana de histórico, para os gráficos)
// [título, descrição, laboratório, categoria, nível, status, aberto há (h), levou (h), solução, técnico]
// ---------------------------------------------------------------------------
const EXEMPLOS = [
  ['Teclado faltando teclas', 'Máquina 7 sem as teclas F e J.', 'Laboratório 03', 'Periféricos', 'P4', 'FECHADO', 160, 30, 'Teclado substituído.', 4],
  ['Atualizar Python para 3.12', 'Aula de IA precisa da versão nova.', 'Laboratório 02', 'Software', 'P3', 'FECHADO', 150, 20, 'Python atualizado via script em todas as máquinas.', 5],
  ['Projetor com cores lavadas', 'Imagem esverdeada.', 'Laboratório 04', 'Audiovisual', 'P2', 'FECHADO', 140, 6, 'Cabo VGA trocado por HDMI.', 4],
  ['Wi-Fi caindo toda hora', 'Conexão cai a cada 10 min.', 'Laboratório 01', 'Rede', 'P1', 'FECHADO', 130, 3, 'Access point reiniciado e firmware atualizado.', 6],
  ['Impressora atolando papel', 'Atola na bandeja 2.', 'Laboratório 03', 'Periféricos', 'P3', 'FECHADO', 120, 30, 'Rolete limpo.', 5],
  ['Senha do Windows expirada', 'Login de aluno bloqueado nas máquinas 1 a 5.', 'Laboratório 02', 'Acesso', 'P2', 'FECHADO', 110, 10, 'Política de senha ajustada no AD.', 6],
  ['Caixa de som sem áudio', 'Som da mesa do professor não sai.', 'Laboratório 01', 'Audiovisual', 'P3', 'RESOLVIDO', 100, 18, 'Driver de áudio reinstalado.', 4],
  ['Instalar Docker Desktop', 'Para a disciplina de Cloud.', 'Laboratório 04', 'Software', 'P3', 'FECHADO', 96, 22, 'Docker instalado com WSL2.', 5],
  ['Máquina 15 não liga', 'Sem sinal de energia.', 'Laboratório 02', 'Hardware', 'P2', 'FECHADO', 90, 11, 'Fonte substituída.', 4],
  ['Ar-condicionado pingando', 'Água em cima da bancada 4.', 'Laboratório 03', 'Infraestrutura', 'P2', 'FECHADO', 80, 5, 'Dreno desobstruído.', 6],
  ['Licença do MATLAB expirada', 'Pedindo ativação.', 'Laboratório 04', 'Software', 'P3', 'RESOLVIDO', 72, 26, 'Licença renovada no servidor.', 5],
  ['Monitor piscando', 'Monitor da máquina 3.', 'Laboratório 02', 'Hardware', 'P3', 'RESOLVIDO', 60, 8, 'Cabo HDMI trocado.', 4],
  ['Sem internet na bancada 2', 'Cabo de rede rompido.', 'Laboratório 01', 'Rede', 'P1', 'RESOLVIDO', 50, 2, 'Cabo de rede refeito.', 6],
  ['Mouse com defeito', 'Mouse da máquina 12 não clica.', 'Laboratório 01', 'Periféricos', 'P4', 'RESOLVIDO', 46, 20, 'Mouse trocado.', 5],
  ['Instalar VS Code', 'Precisamos do VS Code para a aula de quinta.', 'Laboratório 02', 'Software', 'P3', 'ABERTO', 30],
  ['Atualizar Chrome', 'Versão antiga bloqueando o Moodle.', 'Laboratório 03', 'Software', 'P4', 'PENDENTE', 28, null, null, 5],
  ['Webcam não reconhecida', 'Máquina do professor.', 'Laboratório 04', 'Periféricos', 'P3', 'EM_ATENDIMENTO', 20, null, null, 4],
  ['Licença do Office expirada', 'Office pedindo ativação.', 'Laboratório 04', 'Software', 'P2', 'ABERTO', 7],
  ['Projetor não liga', 'Projetor do laboratório sem imagem, lâmpada pisca.', 'Laboratório 01', 'Audiovisual', 'P1', 'ABERTO', 5],
  ['Lentidão no Android Studio', 'Emulador travando nas máquinas antigas.', 'Laboratório 02', 'Software', 'P3', 'ABERTO', 4],
  ['Sem internet nas bancadas', 'Bancadas 5 a 10 sem rede.', 'Laboratório 03', 'Rede', 'P1', 'EM_ATENDIMENTO', 3.3, null, null, 6],
  ['Tomada solta na bancada 6', 'Risco de choque.', 'Laboratório 03', 'Infraestrutura', 'P2', 'ABERTO', 1.5],
  ['Pedido de cadeira nova', 'Cadeira quebrada na bancada 9.', 'Laboratório 01', 'Infraestrutura', 'P4', 'ABERTO', 0.6],
];

function gerarExemplos() {
  const agora = Date.now();
  const chamados = [];
  const historico = [];
  const passo = (id, de, para, quando, usuarioId, observacao = null) => historico.push({
    id: historico.length + 1, chamadoId: id, usuarioId, statusAnterior: de, statusNovo: para,
    observacao, dataAlteracao: new Date(quando).toISOString(),
  });

  EXEMPLOS.forEach(([titulo, descricao, laboratorio, categoria, nivelSla, status, abertoHaH, levouH, solucao, tecnicoId], i) => {
    const id = 1001 + i;
    const abertura = agora - abertoHaH * HORA;
    let atualizacao = abertura;
    if (status !== 'ABERTO') {
      const inicio = abertura + Math.min(abertoHaH, levouH ?? abertoHaH) * 0.2 * HORA;
      passo(id, 'ABERTO', 'EM_ATENDIMENTO', inicio, tecnicoId);
      atualizacao = inicio;
    }
    if (status === 'PENDENTE') {
      atualizacao += 2 * HORA;
      passo(id, 'EM_ATENDIMENTO', 'PENDENTE', atualizacao, tecnicoId, 'Aguardando liberação do setor de TI.');
    }
    if (status === 'RESOLVIDO' || status === 'FECHADO') {
      atualizacao = abertura + levouH * HORA;
      passo(id, 'EM_ATENDIMENTO', 'RESOLVIDO', atualizacao, tecnicoId, solucao);
    }
    const resolvidoEm = status === 'RESOLVIDO' || status === 'FECHADO' ? atualizacao : null;
    if (status === 'FECHADO') {
      atualizacao += 2 * HORA;
      passo(id, 'RESOLVIDO', 'FECHADO', atualizacao, tecnicoId);
    }
    chamados.push({
      id, titulo, descricao, laboratorio, categoria,
      prioridade: PRIORIDADE_DO_NIVEL[nivelSla],
      nivelSla,
      prazoSla: calcularPrazo(abertura, nivelSla).toISOString(),
      status,
      solicitanteId: 20 + (i % 6),
      tecnicoId: status === 'ABERTO' ? null : tecnicoId,
      dataAbertura: new Date(abertura).toISOString(),
      dataAtualizacao: new Date(atualizacao).toISOString(),
      dataResolucao: resolvidoEm ? new Date(resolvidoEm).toISOString() : null,
    });
  });
  return { chamados, historico };
}

// ---------------------------------------------------------------------------
export function criarClienteMock({ armazenamento = armazenamentoPadrao(), semDadosExemplo = false } = {}) {
  function carregar() {
    let chamados = armazenamento.ler();
    let historico = armazenamento.lerHistorico() ?? [];
    if (!Array.isArray(chamados) || !chamados.length) {
      const ex = semDadosExemplo ? { chamados: [], historico: [] } : gerarExemplos();
      chamados = ex.chamados;
      historico = ex.historico;
      armazenamento.salvar(chamados);
      armazenamento.salvarHistorico(historico);
    }
    return { chamados, historico };
  }

  const comTecnico = (c) => ({ ...c, tecnicoNome: c.tecnicoNome ?? TECNICOS[c.tecnicoId] ?? null });

  return {
    async listar(status) {
      if (status && !STATUS.includes(status)) throw new ApiErro(400, 'Status informado inválido.');
      const { chamados } = carregar();
      const filtrados = status ? chamados.filter((c) => c.status === status) : chamados;
      return ordenarFila(filtrados).map(comTecnico);
    },

    async buscar(id) {
      const c = carregar().chamados.find((x) => x.id === Number(id));
      if (!c) throw new ApiErro(404, 'Chamado não encontrado.');
      return comTecnico(c);
    },

    async criar(dados) {
      const erros = validarNovoChamado(dados ?? {});
      if (erros.length) throw new ApiErro(400, erros.join(' '));
      const { chamados } = carregar();
      const agora = new Date();
      const chamado = {
        id: chamados.reduce((m, c) => Math.max(m, c.id), 1000) + 1,
        titulo: dados.titulo.trim(),
        descricao: dados.descricao.trim(),
        laboratorio: dados.laboratorio.trim(),
        categoria: dados.categoria ?? null,
        prioridade: PRIORIDADE_DO_NIVEL[dados.nivelSla],
        nivelSla: dados.nivelSla,
        prazoSla: calcularPrazo(agora, dados.nivelSla).toISOString(),
        status: 'ABERTO',
        solicitanteId: dados.solicitanteId ?? USUARIO_ATUAL,
        tecnicoId: null,
        dataAbertura: agora.toISOString(),
        dataAtualizacao: agora.toISOString(),
      };
      chamados.push(chamado);
      armazenamento.salvar(chamados);
      return comTecnico(chamado);
    },

    // Mesmas regras de backend/src/services/statusService.js + RF5 (solução obrigatória)
    async mudarStatus(id, status, observacao) {
      const { chamados, historico } = carregar();
      const chamado = chamados.find((c) => c.id === Number(id));
      if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new ApiErro(400, 'ID do chamado inválido.');
      if (!STATUS.includes(status)) throw new ApiErro(400, 'Status informado inválido.');
      if (!chamado) throw new ApiErro(404, 'Chamado não encontrado.');
      if (!TRANSICOES[chamado.status]?.includes(status)) {
        throw new ApiErro(409, `Não é permitido alterar o status de ${chamado.status} para ${status}.`);
      }
      if (status === 'RESOLVIDO' && !observacao?.trim()) {
        throw new ApiErro(400, 'A solução aplicada é obrigatória para resolver o chamado.');
      }
      const agora = new Date().toISOString();
      historico.push({
        id: historico.reduce((m, h) => Math.max(m, h.id), 0) + 1,
        chamadoId: chamado.id,
        usuarioId: USUARIO_ATUAL,
        statusAnterior: chamado.status,
        statusNovo: status,
        observacao: observacao?.trim() || null,
        dataAlteracao: agora,
      });
      chamado.status = status;
      chamado.dataAtualizacao = agora;
      if (status === 'EM_ATENDIMENTO' && chamado.tecnicoId == null) chamado.tecnicoId = USUARIO_ATUAL;
      if (status === 'RESOLVIDO') chamado.dataResolucao = agora;
      armazenamento.salvar(chamados);
      armazenamento.salvarHistorico(historico);
      return comTecnico(chamado);
    },

    async historico(id) {
      const { chamados, historico } = carregar();
      if (!chamados.some((c) => c.id === Number(id))) throw new ApiErro(404, 'Chamado não encontrado.');
      return historico
        .filter((h) => h.chamadoId === Number(id))
        .sort((a, b) => new Date(b.dataAlteracao) - new Date(a.dataAlteracao));
    },

    // Só do mock: volta aos dados de exemplo (link "restaurar" na barra lateral)
    async restaurar() {
      armazenamento.salvar([]);
      armazenamento.salvarHistorico([]);
      carregar();
    },
  };
}
