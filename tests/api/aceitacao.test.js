// Testes de ACEITAÇÃO contra o backend real (CA1 a CA5).
// Uso:
//   API_URL=http://localhost:3000/api npm run test:api
//   API_URL=https://<app>.azurewebsites.net/api npm run test:api
// Sem API_URL os testes são pulados (o backend ainda pode não estar no ar).
//
// Os testes criam chamados com título "[teste] ..." — use um banco de testes
// ou apague-os depois (ver tests/sql/limpar_testes.sql).

import { test } from 'node:test';
import { criarClienteHttp } from '../../src/js/api.js';
import { executarContrato } from '../contrato.js';

const url = process.env.API_URL;

if (!url) {
  test('aceitação da API', { skip: 'defina API_URL para rodar contra o backend' }, () => {});
} else {
  executarContrato(`backend em ${url}`, () => criarClienteHttp(url));
}
