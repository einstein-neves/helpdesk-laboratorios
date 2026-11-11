// Cliente da API de chamados, seguindo docs/contratos-api.md
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

// Escolhe entre a API real e o mock conforme config.js
export function criarCliente(config) {
  return config.USE_MOCK ? criarClienteMock() : criarClienteHttp(config.API_BASE_URL);
}
