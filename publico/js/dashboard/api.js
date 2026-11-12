// Cliente da API de chamados, seguindo docs/GUIA-PROJETO.md
//
//   GET   /api/tickets?status=ABERTO     → lista de chamados
//   GET   /api/tickets/:id               → um chamado
//   POST  /api/tickets                   → cria chamado
//   PATCH /api/tickets/:id/status        → { status, observacao }   (400 | 404 | 409)
//   GET   /api/tickets/:id/history       → histórico de alterações
//
// Respostas no formato padrão da equipe: { success, data, message }.

import { ApiErro } from './api-erro.js';
import { criarClienteMock } from './mock-api.js';

export function criarClienteHttp(baseUrl, { fetch: fetchFn = globalThis.fetch, headers = {} } = {}) {
  const base = baseUrl.replace(/\/$/, '');

  async function requisicao(metodo, caminho, corpo) {
    let resp;
    try {
      resp = await fetchFn(base + caminho, {
        method: metodo,
        headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiErro(0, 'Não foi possível conectar à API.');
    }
    let dados = null;
    try { dados = await resp.json(); } catch { /* resposta sem JSON */ }
    if (!resp.ok || dados?.success === false) {
      throw new ApiErro(resp.status, dados?.message ?? `Erro ${resp.status}`);
    }
    return dados?.data ?? null;
  }

  return {
    listar(status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      return requisicao('GET', `/tickets${qs}`);
    },
    buscar(id) {
      return requisicao('GET', `/tickets/${id}`);
    },
    criar(dados) {
      return requisicao('POST', '/tickets', dados);
    },
    mudarStatus(id, status, observacao) {
      const corpo = observacao === undefined ? { status } : { status, observacao };
      return requisicao('PATCH', `/tickets/${id}/status`, corpo);
    },
    historico(id) {
      return requisicao('GET', `/tickets/${id}/history`);
    },
  };
}

// Cliente padrão: usa a sessão do login (HelpDeskAuth) para enviar o token,
// como as telas de abertura e atendimentos. Assim o dashboard mostra os mesmos
// chamados do restante do sistema.
export function criarClienteAutenticado(auth = globalThis.HelpDeskAuth) {
  async function requisicao(caminho, opcoes) {
    try {
      return await auth.request(caminho, opcoes);
    } catch (e) {
      throw new ApiErro(0, e?.message ?? 'Não foi possível concluir a operação.');
    }
  }
  const json = (metodo, corpo) => ({ method: metodo, body: JSON.stringify(corpo) });

  return {
    // A API devolve até 50 chamados por página; percorre todas.
    async listar(status) {
      const filtro = status ? `&status=${encodeURIComponent(status)}` : '';
      const todos = [];
      for (let offset = 0; ; offset += 50) {
        const lote = await requisicao(`/tickets?offset=${offset}${filtro}`) ?? [];
        todos.push(...lote);
        if (lote.length < 50) return todos;
      }
    },
    buscar: (id) => requisicao(`/tickets/${id}`),
    criar: (dados) => requisicao('/tickets', json('POST', dados)),
    mudarStatus(id, status, observacao) {
      const corpo = observacao === undefined ? { status } : { status, observacao };
      return requisicao(`/tickets/${id}/status`, json('PATCH', corpo));
    },
    historico: (id) => requisicao(`/tickets/${id}/history`),
  };
}

// Escolhe o cliente conforme config.js: mock só quando pedido explicitamente.
export function criarCliente(config) {
  if (config.USE_MOCK) return criarClienteMock();
  if (!config.API_EXTERNA && globalThis.HelpDeskAuth) return criarClienteAutenticado();
  return criarClienteHttp(config.API_BASE_URL);
}
