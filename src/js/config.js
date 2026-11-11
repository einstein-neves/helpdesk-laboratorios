// Configuração da interface.
// USE_MOCK = true  → usa dados de exemplo no navegador (enquanto o backend não está pronto)
// USE_MOCK = false → usa a API real em API_BASE_URL
//
// Também dá para trocar pela URL, sem editar o arquivo:
//   index.html?api=https://minha-api.azurewebsites.net/api   → API real
//   index.html?mock=1                                         → mock

const params = new URLSearchParams(globalThis.location?.search ?? '');

export const CONFIG = {
  USE_MOCK: params.has('api') ? false : params.get('mock') !== '0',
  API_BASE_URL: params.get('api') ?? '/api',
  ATUALIZAR_A_CADA_MS: 60_000, // recalcula "SLA vencido" sem recarregar a página
};
