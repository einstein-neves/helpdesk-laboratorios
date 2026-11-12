// Configuração do dashboard.
// Padrão           → API real do sistema (/api), autenticada com a sessão do login;
//                    mostra os mesmos chamados das telas de abertura e atendimentos.
// USE_MOCK = true  → dados de exemplo guardados no navegador (localStorage), só
//                    para demonstrar a interface sem backend.
//
// Dá para trocar pela URL, sem editar o arquivo:
//   dashboard.html?mock=1                           → dados de exemplo
//   dashboard.html?api=http://localhost:3000/api   → outra API, sem a sessão do login

const params = new URLSearchParams(globalThis.location?.search ?? '');

export const CONFIG = {
  USE_MOCK: !params.has('api') && params.get('mock') === '1',
  API_EXTERNA: params.has('api'),
  API_BASE_URL: params.get('api') ?? '/api',
  ATUALIZAR_A_CADA_MS: 60_000, // recalcula "SLA vencido" sem recarregar a página
};
