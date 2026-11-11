// Testes de ACEITAÇÃO contra o backend real (CA1 a CA5 + histórico).
// Uso:
//   API_URL=http://localhost:3000/api npm run test:api
//   API_URL=http://localhost:3000/api API_TOKEN=<token do login> npm run test:api
// Sem API_URL os testes são pulados.
//
// As rotas de status exigem usuário autenticado; enquanto o login não estiver
// integrado, elas respondem 401 e os testes dessas rotas falham — é esperado.
// Os testes criam chamados com título "[teste] ..." (ver tests/sql/limpar_testes.sql).

import { test } from 'node:test';
import { criarClienteHttp } from '../../publico/js/dashboard/api.js';
import { executarContrato } from '../contrato.js';

const url = process.env.API_URL;
const token = process.env.API_TOKEN;

if (!url) {
  test('aceitação da API', { skip: 'defina API_URL para rodar contra o backend' }, () => {});
} else {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  executarContrato(`backend em ${url}`, () => criarClienteHttp(url, { headers }));
}
