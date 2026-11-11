// Teste de ponta a ponta da interface (opcional — usa Playwright).
// 1) npm i -D playwright && npx playwright install chromium
// 2) em outro terminal: cd src && python3 -m http.server 5500
// 3) npm run test:e2e        (ou E2E_URL=http://... npm run test:e2e)
import { chromium } from 'playwright';

const URL = process.env.E2E_URL ?? 'http://localhost:5500/index.html';
const ok = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('✔', m); };
// Roda no modo demonstração (mock), começando dos dados de exemplo.
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${URL}?mock=1#fila`);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  ok(await p.locator('[data-filtro="ativos"][aria-selected="true"]').count() === 1, 'fila abre em "Ativos"');
  const prios = await p.$$eval('#lista-corpo .linha .pri-txt', els => els.map(e => e.textContent));
  ok(prios.join() === [...prios].sort().join(), 'fila ordenada por prioridade (CA4)');
  // atender HD-19 pela gaveta
  await p.click('.linha[data-id="19"]'); await p.waitForTimeout(300);
  await p.click('.gaveta-acoes button[data-prox="em_atendimento"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#gaveta .gaveta-tags')).includes('Em atendimento'), 'atender pela gaveta muda status');
  await p.click('.gaveta-acoes button[data-prox="resolvido"]');
  await p.click('#form-resolver button[type=submit]');
  ok(await p.isVisible('#dlg-erro'), 'resolver sem solução é bloqueado (RF5)');
  await p.fill('#f-solucao', 'Lâmpada trocada.'); await p.click('#form-resolver button[type=submit]'); await p.waitForTimeout(300);
  ok((await p.textContent('#gaveta')).includes('Lâmpada trocada.'), 'solução aparece na gaveta');
  ok(await p.locator('.gaveta-acoes button[data-prox="fechado"]').count() === 1, 'resolvido só oferece "Fechar"');
  await p.keyboard.press('Escape');
  // novo chamado pelo atalho C, com P7 impossível e campos vazios
  await p.keyboard.press('c'); await p.click('#form-novo button[type=submit]');
  ok(await p.isVisible('#erros-form'), 'formulário vazio mostra erros');
  await p.fill('#f-titulo', 'Teste e2e'); await p.fill('#f-descricao', 'desc'); await p.fill('#f-laboratorio', 'Lab 09');
  await p.click('#escolha-prioridade label:has(input[value="P1"])');
  ok((await p.textContent('#previa-prazo')).includes('(4 h)'), 'prévia mostra prazo de 4 h para P1');
  await p.click('#form-novo button[type=submit]'); await p.waitForTimeout(400);
  ok((await p.textContent('#gaveta h2')).includes('Teste e2e'), 'novo chamado abre na gaveta');
  await p.keyboard.press('Escape');
  // tema
  await p.click('[data-acao="tema"]'); ok(['dark','light'].includes(await p.evaluate(() => document.documentElement.dataset.theme)), 'alterna tema');
  ok(errs.length === 0, 'sem erros de JavaScript ' + errs.join(';'));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
