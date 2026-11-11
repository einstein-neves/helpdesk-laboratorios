// API FALSA (mock) para desenvolver e demonstrar a interface sem o backend.
// Segue o mesmo contrato da API real e devolve os mesmos códigos de erro,
// por isso a suíte de testes de contrato roda contra ela e contra o backend.
// Quando o backend estiver no ar, basta USE_MOCK = false em config.js.

import { ApiErro } from './api-erro.js';
import {
  STATUS, TRANSICOES, calcularPrazo, ordenarFila, validarNovoChamado,
} from './regras-ui.js';

const CHAVE = 'helpdesk-mock-chamados-v2';
const HORA = 60 * 60 * 1000;

function armazenamentoPadrao() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('__teste__', '1');
    ls.removeItem('__teste__');
    return {
      ler: () => JSON.parse(ls.getItem(CHAVE) ?? 'null'),
      salvar: (dados) => ls.setItem(CHAVE, JSON.stringify(dados)),
    };
  } catch {
    let memoria = null; // Node (testes) ou navegador sem localStorage
    return { ler: () => memoria, salvar: (d) => { memoria = d; } };
  }
}

function novo([titulo, descricao, laboratorio, prioridade, status, abertoHaHoras, levouHoras, solucao], id) {
  const aberto = new Date(Date.now() - abertoHaHoras * HORA);
  const finalizado = status === 'resolvido' || status === 'fechado';
  return {
    id, titulo, descricao, laboratorio, prioridade, status,
    solucao: finalizado ? solucao : null,
    aberto_em: aberto.toISOString(),
    prazo_sla: calcularPrazo(aberto, prioridade).toISOString(),
    resolvido_em: finalizado ? new Date(aberto.getTime() + levouHoras * HORA).toISOString() : null,
  };
}

// [título, descrição, laboratório, prioridade, status, aberto há (h), levou (h) p/ resolver, solução]
const EXEMPLOS = [
  ['Teclado faltando teclas', 'Máquina 7 sem as teclas F e J.', 'Lab 03', 'P4', 'fechado', 160, 30, 'Teclado substituído.'],
  ['Atualizar Python para 3.12', 'Aula de IA precisa da versão nova.', 'Lab 02', 'P3', 'fechado', 150, 20, 'Python atualizado via script em todas as máquinas.'],
  ['Projetor com cores lavadas', 'Imagem esverdeada.', 'Lab 04', 'P2', 'fechado', 140, 6, 'Cabo VGA trocado por HDMI.'],
  ['Wi-Fi caindo toda hora', 'Conexão cai a cada 10 min.', 'Lab 01', 'P1', 'fechado', 130, 3, 'Access point reiniciado e firmware atualizado.'],
  ['Impressora atolando papel', 'Atola na bandeja 2.', 'Lab 03', 'P3', 'fechado', 120, 30, 'Rolete limpo.'],
  ['Senha do Windows expirada', 'Login de aluno bloqueado nas máquinas 1 a 5.', 'Lab 02', 'P2', 'fechado', 110, 10, 'Política de senha ajustada no AD.'],
  ['Caixa de som sem áudio', 'Som da mesa do professor não sai.', 'Lab 01', 'P3', 'resolvido', 100, 18, 'Driver de áudio reinstalado.'],
  ['Instalar Docker Desktop', 'Para a disciplina de Cloud.', 'Lab 04', 'P3', 'fechado', 96, 22, 'Docker instalado com WSL2.'],
  ['Máquina 15 não liga', 'Sem sinal de energia.', 'Lab 02', 'P2', 'fechado', 90, 11, 'Fonte substituída.'],
  ['Ar-condicionado pingando', 'Água em cima da bancada 4.', 'Lab 03', 'P2', 'fechado', 80, 5, 'Dreno desobstruído.'],
  ['Licença do MATLAB expirada', 'Pedindo ativação.', 'Lab 04', 'P3', 'resolvido', 72, 26, 'Licença renovada no servidor.'],
  ['Monitor piscando', 'Monitor da máquina 3.', 'Lab 02', 'P3', 'resolvido', 60, 8, 'Cabo HDMI trocado.'],
  ['Sem internet na bancada 2', 'Cabo de rede rompido.', 'Lab 01', 'P1', 'resolvido', 50, 2, 'Cabo de rede refeito.'],
  ['Mouse com defeito', 'Mouse da máquina 12 não clica.', 'Lab 01', 'P4', 'resolvido', 46, 20, 'Mouse trocado.'],
  ['Instalar VS Code', 'Precisamos do VS Code para a aula de quinta.', 'Lab 02', 'P3', 'aberto', 30],
  ['Atualizar Chrome', 'Versão antiga bloqueando o Moodle.', 'Lab 03', 'P4', 'aberto', 28],
  ['Webcam não reconhecida', 'Máquina do professor.', 'Lab 04', 'P3', 'em_atendimento', 20],
  ['Licença do Office expirada', 'Office pedindo ativação.', 'Lab 04', 'P2', 'aberto', 7],
  ['Projetor não liga', 'Projetor do lab sem imagem, lâmpada pisca.', 'Lab 01', 'P1', 'aberto', 5],
  ['Lentidão no Android Studio', 'Emulador travando nas máquinas antigas.', 'Lab 02', 'P3', 'aberto', 4],
  ['Sem internet nas bancadas', 'Bancadas 5 a 10 sem rede.', 'Lab 03', 'P1', 'em_atendimento', 3.3],
  ['Tomada solta na bancada 6', 'Risco de choque.', 'Lab 03', 'P2', 'aberto', 1.5],
  ['Pedido de cadeira nova', 'Cadeira quebrada na bancada 9.', 'Lab 01', 'P4', 'aberto', 0.6],
];

function dadosExemplo() {
  return EXEMPLOS.map((e, i) => novo(e, i + 1));
}

export function criarClienteMock({ armazenamento = armazenamentoPadrao(), semDadosExemplo = false } = {}) {
  let chamados = armazenamento.ler() ?? (semDadosExemplo ? [] : dadosExemplo());
  const salvar = () => armazenamento.salvar(chamados);
  const copia = (c) => ({ ...c });

  return {
    async listar(status) {
      if (status && !STATUS.includes(status)) throw new ApiErro(400, 'Status inválido.');
      const filtrados = status ? chamados.filter((c) => c.status === status) : chamados;
      return ordenarFila(filtrados).map(copia);
    },

    async criar(dados) {
      const erros = validarNovoChamado(dados ?? {});
      if (erros.length) throw new ApiErro(400, erros.join(' '));
      const agora = new Date();
      const chamado = {
        id: chamados.reduce((m, c) => Math.max(m, c.id), 0) + 1,
        titulo: dados.titulo.trim(),
        descricao: dados.descricao.trim(),
        laboratorio: dados.laboratorio.trim(),
        prioridade: dados.prioridade,
        status: 'aberto',
        solucao: null,
        aberto_em: agora.toISOString(),
        prazo_sla: calcularPrazo(agora, dados.prioridade).toISOString(),
        resolvido_em: null,
      };
      chamados.push(chamado);
      salvar();
      return copia(chamado);
    },

    async mudarStatus(id, status, solucao) {
      const chamado = chamados.find((c) => c.id === Number(id));
      if (!chamado) throw new ApiErro(404, 'Chamado não encontrado.');
      if (!STATUS.includes(status)) throw new ApiErro(400, 'Status inválido.');
      if (!TRANSICOES[chamado.status].includes(status)) {
        throw new ApiErro(409, `Transição inválida: ${chamado.status} → ${status}.`);
      }
      if (status === 'resolvido') {
        if (!solucao?.trim()) throw new ApiErro(400, 'A solução aplicada é obrigatória para resolver.');
        chamado.solucao = solucao.trim();
        chamado.resolvido_em = new Date().toISOString();
      }
      chamado.status = status;
      salvar();
      return copia(chamado);
    },

    // Só do mock: volta aos dados de exemplo (botão "Restaurar exemplo" na tela)
    async restaurar() {
      chamados = semDadosExemplo ? [] : dadosExemplo();
      salvar();
    },
  };
}
