// Teste de ponta a ponta do dashboard (opcional — usa Playwright).
// 1) npm i -D playwright && npx playwright install chromium
// 2) em outro terminal: cd publico && python3 -m http.server 5500
// 3) npm run test:e2e        (ou E2E_URL=http://.../ npm run test:e2e)
// Roda no modo demonstração, começando dos dados de exemplo.
import { chromium } from 'playwright';

const BASE = (process.env.E2E_URL ?? 'http://localhost:5500/').replace(/\/?$/, '/');
const ok = (c, m) => { if (!c) throw new Error(`FALHOU: ${m}`); console.log('✔', m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));

  await p.goto(`${BASE}dashboard.html?mock=1#fila`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('#lista-corpo .linha');

  ok(await p.locator('[data-filtro="ativos"][aria-selected="true"]').count() === 1, 'acompanhamento abre em "Ativos"');
  const niveis = await p.$$eval('#lista-corpo .linha .pri-txt', (els) => els.map((e) => e.textContent));
  ok(niveis.join() === [...niveis].sort().join(), 'fila ordenada por nível de SLA (CA4)');

  // Chamado ABERTO: assumir fica na tela de Atendimentos
  const aberto = p.locator('.linha', { hasText: 'Projetor não liga' });
  await aberto.click();
  await p.waitForSelector('#gaveta.aberta');
  ok(await p.locator('.gaveta-acoes a[href="atendimentos.html"]').count() === 1, 'ABERTO leva para a tela de Atendimentos');
  await p.keyboard.press('Escape');

  // Chamado EM_ATENDIMENTO: pendente → retomar → resolver
  await p.locator('.linha', { hasText: 'Webcam não reconhecida' }).click();
  await p.click('.gaveta-acoes button[data-prox="PENDENTE"]');
  await p.waitForTimeout(200);
  ok((await p.textContent('#gaveta .gaveta-tags')).includes('Pendente'), 'marca como pendente');
  await p.click('.gaveta-acoes button[data-prox="EM_ATENDIMENTO"]');
  await p.waitForTimeout(200);
  await p.click('.gaveta-acoes button[data-prox="RESOLVIDO"]');
  await p.click('#form-resolver button[type=submit]');
  ok(await p.isVisible('#dlg-erro'), 'resolver sem solução é bloqueado (RF5)');
  await p.fill('#f-solucao', 'Driver da webcam reinstalado.');
  await p.click('#form-resolver button[type=submit]');
  await p.waitForTimeout(300);
  ok((await p.textContent('#gaveta')).includes('Driver da webcam reinstalado.'), 'solução aparece no painel e no histórico');
  ok(await p.locator('#gaveta .linha-tempo-v li').count() >= 5, 'histórico mostra todas as mudanças');
  ok(await p.locator('.gaveta-acoes button[data-prox="FECHADO"]').count() === 1, 'resolvido só oferece "Fechar"');
  await p.keyboard.press('Escape');

  // Dashboard
  await p.goto(`${BASE}dashboard.html?mock=1#dashboard`);
  await p.waitForSelector('#kpis .kpi');
  ok(await p.locator('#graf-volume svg path').count() > 0, 'gráfico de volume desenhado');
  ok(await p.locator('#tabela-risco tbody tr').count() > 0, 'tabela de chamados em risco preenchida');

  // Telas da equipe continuam funcionando com os mesmos dados
  for (const tela of ['index.html', 'abertura.html', 'atendimentos.html']) {
    await p.goto(BASE + tela);
    await p.waitForTimeout(400);
  }
  ok(erros.length === 0, `sem erros de JavaScript nas telas ${erros.join(' | ')}`);
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
