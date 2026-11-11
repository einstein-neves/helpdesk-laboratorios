// Configuração do dashboard.
// USE_MOCK = true  → usa os dados de demonstração do navegador (os mesmos das
//                    telas de abertura e atendimentos: localStorage "helpdesk_chamados")
// USE_MOCK = false → usa a API real em API_BASE_URL
//
// Também dá para trocar pela URL, sem editar o arquivo:
//   dashboard.html?api=http://localhost:3000/api   → API real
//   dashboard.html?mock=1                           → dados de demonstração

const params = new URLSearchParams(globalThis.location?.search ?? '');

export const CONFIG = {
  USE_MOCK: params.has('api') ? false : params.get('mock') !== '0',
  API_BASE_URL: params.get('api') ?? '/api',
  ATUALIZAR_A_CADA_MS: 60_000, // recalcula "SLA vencido" sem recarregar a página
};
