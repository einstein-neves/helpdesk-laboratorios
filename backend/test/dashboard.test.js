const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulo = (arquivo) => import(pathToFileURL(path.resolve(__dirname, '../../publico/js/dashboard', arquivo)).href);

test('dashboard usa a API autenticada por padrão e o mock só com ?mock=1', async () => {
 const { CONFIG } = await modulo('config.js');
 assert.equal(CONFIG.USE_MOCK, false);
 assert.equal(CONFIG.API_BASE_URL, '/api');
});

test('cliente do dashboard envia as chamadas pela sessão do login e percorre as páginas', async () => {
 const { criarClienteAutenticado } = await modulo('api.js');
 const chamadas = [];
 const auth = {
  request: async (caminho, opcoes) => {
   chamadas.push({ caminho, metodo: opcoes?.method, corpo: opcoes?.body });
   if (caminho.startsWith('/tickets?offset=0')) return Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
   if (caminho.startsWith('/tickets?offset=50')) return [{ id: 51 }];
   return { id: 7, status: 'PENDENTE' };
  }
 };
 const api = criarClienteAutenticado(auth);

 assert.equal((await api.listar('ABERTO')).length, 51);
 assert.deepEqual(chamadas.map(c => c.caminho), ['/tickets?offset=0&status=ABERTO', '/tickets?offset=50&status=ABERTO']);

 await api.mudarStatus(7, 'PENDENTE', 'Aguardando peça');
 assert.deepEqual(chamadas.at(-1), {
  caminho: '/tickets/7/status',
  metodo: 'PATCH',
  corpo: JSON.stringify({ status: 'PENDENTE', observacao: 'Aguardando peça' })
 });
});

test('cliente do dashboard repassa a mensagem de erro da API', async () => {
 const { criarClienteAutenticado } = await modulo('api.js');
 const api = criarClienteAutenticado({ request: async () => { throw new Error('Sem permissao para esta operacao.'); } });
 await assert.rejects(api.historico(1), { name: 'ApiErro', message: 'Sem permissao para esta operacao.' });
});
