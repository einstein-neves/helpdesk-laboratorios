// Cliente da API de chamados. Contrato documentado em docs/interface-dashboard-testes.md
//
//   GET   /chamados?status=aberto      → 200 [chamado...]  (fila já ordenada)
//   POST  /chamados                    → 201 chamado | 400
//   PATCH /chamados/:id/status         → 200 chamado | 400 | 404 | 409
//
// Erros vêm no corpo como { "erro": "mensagem" }.

import { ApiErro } from './api-erro.js';
import { criarClienteMock } from './mock-api.js';

export function criarClienteHttp(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');

  async function requisicao(metodo, caminho, corpo) {
    let resp;
    try {
      resp = await fetch(base + caminho, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiErro(0, 'Não foi possível conectar à API.');
    }
    const texto = await resp.text();
    const dados = texto ? JSON.parse(texto) : null;
    if (!resp.ok) throw new ApiErro(resp.status, dados?.erro ?? `Erro ${resp.status}`);
    return dados;
  }

  return {
    listar(status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      return requisicao('GET', `/chamados${qs}`);
    },
    criar(dados) {
      return requisicao('POST', '/chamados', dados);
    },
    mudarStatus(id, status, solucao) {
      const corpo = solucao === undefined ? { status } : { status, solucao };
      return requisicao('PATCH', `/chamados/${id}/status`, corpo);
    },
  };
}

// Escolhe entre a API real e o mock conforme config.js
export function criarCliente(config) {
  return config.USE_MOCK ? criarClienteMock() : criarClienteHttp(config.API_BASE_URL);
}
