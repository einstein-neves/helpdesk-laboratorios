# Interface, Dashboard e Testes

**Responsável:** Guilherme

Este documento descreve o dashboard (`publico/dashboard.html`) e a suíte de testes do projeto (`tests/`): o que foi feito, como rodar, como se integra ao restante do sistema e quais decisões foram tomadas.

## 1. O que foi entregue

| Item | Arquivo(s) | Requisitos |
|---|---|---|
| Página do dashboard com barra lateral, tema claro/escuro, busca e comandos (⌘K) e atalhos | `publico/dashboard.html`, `publico/css/dashboard.css`, `publico/js/dashboard/app.js` | — |
| Indicadores: chamados ativos, SLA vencido, % de cumprimento do SLA, tempo médio de resolução, volume dos últimos 7 dias, ativos por nível de SLA, chamados em risco e ativos por laboratório | `publico/js/dashboard/regras-ui.js` | RF6 + extra "contagem por status" |
| Acompanhamento de todos os chamados, ordenado, com abas por status (Ativos, Todos, cada status, SLA em risco) e busca | `publico/js/dashboard/app.js` | RF3 / CA4 |
| Selos de SLA com contagem regressiva: verde (no prazo), âmbar (menos de 25% do prazo restante) e vermelho (vencido, valor negativo) | `publico/js/dashboard/regras-ui.js` | RF6 |
| Painel de detalhes com barra de progresso do SLA e o **histórico real** do chamado (`GET /api/tickets/:id/history`) | `publico/js/dashboard/app.js` | — |
| Mudança de status com os botões das transições válidas do backend, e solução obrigatória ao resolver (enviada como `observacao`) | `publico/js/dashboard/app.js` | RF4, RF5 / CA1, CA2 |
| Cliente da API no padrão da equipe e mock com os mesmos dados das outras telas | `publico/js/dashboard/api.js`, `mock-api.js`, `config.js` | — |
| Testes unitários, de contrato/aceitação (CA1 a CA5), de ponta a ponta e scripts SQL | `tests/` | CA1 a CA5, RF6 |

### Integração com as telas da equipe

- **Mesmos dados:** no modo demonstração, o dashboard lê e grava no mesmo `localStorage` (`helpdesk_chamados`) usado por `abertura.html` e `atendimentos.html`. Um chamado aberto ou assumido numa tela aparece nas outras.
- **Sem duplicar funções:** "Novo chamado" (tecla `C`) leva para a tela de **abertura**. Para chamados `ABERTO`, o botão "Assumir em Atendimentos" leva para a tela de **atendimentos**, que atribui o técnico. O dashboard só muda os demais status (pendente, retomar, resolver e fechar).
- **Mesmos nomes do contrato** (`docs/contratos-api.md`): status `ABERTO`, `EM_ATENDIMENTO`, `PENDENTE`, `RESOLVIDO` e `FECHADO`; prioridade `ALTA`, `MEDIA` e `BAIXA` com o nível `P1` a `P4` em `nivelSla`; campos `dataAbertura` e `prazoSla`; respostas `{ success, data, message }`.
- **Compatível com chamados antigos:** se um chamado não tiver `nivelSla`, o nível é deduzido da prioridade (ALTA→P2, MEDIA→P3, BAIXA→P4). Se não tiver `prazoSla`, o prazo é calculado pela abertura.
- A página inicial (`index.html`) ganhou um link para o dashboard.

### Referências de design

O visual segue padrões das ferramentas de mercado que mais se destacam, sem usar a marca de nenhuma delas:

| Referência | O que adotamos |
|---|---|
| **Linear** | Barra lateral escura e fixa, lista densa com uma linha por chamado, ícones de nível em "sinal", paleta de comandos ⌘K, atalhos de uma letra, tema escuro e cores fortes só para status e prioridade |
| **Zendesk** | Selos de SLA com contagem regressiva verde, âmbar e vermelha, com valor negativo quando vence (ex.: `-2h`) |
| **Dashboards de service desk** (Zendesk, Freshdesk, Geckoboard) | Cumprimento do SLA, tempo de resolução, volume por dia, quebra por prioridade e tabela de chamados prestes a vencer |

As cores dos gráficos foram conferidas para pessoas com daltonismo, e cada cor sempre aparece junto de um texto ou legenda.

**Atalhos:** `C` abre um novo chamado, `⌘K`/`Ctrl+K` ou `/` abre a busca, `G` depois `D` vai para o Dashboard, `G` depois `F` vai para o Acompanhamento, e `Esc` fecha o que estiver aberto.

## 2. Como rodar

**Dashboard** (precisa de um servidor local, porque o JS usa módulos ES):

```bash
cd publico
python3 -m http.server 5500
# abrir http://localhost:5500/dashboard.html
```

No VS Code, também dá para usar a extensão Live Server.

Por padrão, a página usa os dados de demonstração do navegador. Para usar o backend:

```
http://localhost:5500/dashboard.html?api=http://localhost:3000/api
```

**Testes** (Node 18 ou mais novo; os testes unitários não precisam instalar nada):

```bash
npm test                                            # unitários + métricas + contrato no mock
API_URL=http://localhost:3000/api npm run test:api  # aceitação contra o backend real
npm run test:e2e                                    # ponta a ponta no navegador (opcional)
```

Se as rotas exigirem login, informe o token com `API_TOKEN=<token>`.

## 3. Testes

| Arquivo | O que testa |
|---|---|
| `tests/unit/regras-ui.test.js` | Prazo do SLA (CA3: P1 às 19:00 → 23:00), compatibilidade com chamados sem `nivelSla`/`prazoSla`, SLA vencido (RF6), ordenação da fila (CA4), transições exibidas (iguais às do backend), validação (CA5) e resumo do dashboard |
| `tests/unit/metricas.test.js` | Cores e textos dos selos de SLA, % de cumprimento, tempo médio de resolução, volume por dia, contagem por laboratório e chamados em risco |
| `tests/contrato.js` | **Suíte de aceitação CA1 a CA5** e do histórico. Roda contra o mock (`tests/unit/mock-api.test.js`) e contra o backend real (`tests/api/aceitacao.test.js`) |
| `tests/e2e/fluxos.e2e.js` | Abre o navegador (Playwright) e testa: fila ordenada, ida para Atendimentos, pendente → retomar → resolver sem solução (bloqueia) e com solução, histórico, dashboard e as telas da equipe sem erros |
| `tests/sql/seed_sla_vencido_postgres.sql` | Insere chamados com `data_abertura` antiga direto no banco para testar o "SLA vencido", como pede o enunciado. Foi validado contra `backend/database/schema.sql` |
| `tests/sql/limpar_testes.sql` | Apaga os dados criados pelos testes (títulos começando com `[teste]`) |

Para o teste de ponta a ponta: rode `npm i -D playwright`, depois `npx playwright install chromium`, deixe `python3 -m http.server 5500` rodando dentro de `publico` e então `npm run test:e2e`.

### Roteiro de evidências (prints)

| Evidência | Como gerar |
|---|---|
| CA1: `ABERTO → FECHADO` → 409 | Saída do `npm run test:api` (teste "CA1") |
| CA2: resolver sem solução → 400 | Saída do teste "CA2" + print da janela de resolução bloqueando sem solução |
| CA3: P1 às 19:00 → 23:00 | Saída do `npm test` (teste "CA3") |
| CA4: fila ordenada | Abrir um P3 e depois um P1 e tirar print do Acompanhamento com o P1 acima |
| CA5: P7 → 400 | Saída do teste "CA5" |
| RF6: SLA vencido | Rodar o seed SQL, tirar print do `SELECT` final e do card "SLA vencido" no dashboard |

## 4. Pontos para a equipe

A suíte de aceitação contra o backend mostra o que ainda falta para fechar os critérios do enunciado:

1. **Rotas que ainda não existem:** `GET /api/tickets` (com filtro `?status=` e ordenação por nível e antiguidade, RF3/CA4), `GET /api/tickets/:id` e `POST /api/tickets` (com `nivelSla` e recusando `P7` com 400, CA5). O dashboard também ordena do lado da tela, por segurança.
2. **CA2 / RF5:** o backend ainda aceita `RESOLVIDO` sem `observacao`. O enunciado exige 400 quando a solução está vazia. O mock e a tela já fazem essa checagem.
3. **Banco:** o enunciado pede `prazo_sla` na tabela, e o dashboard se beneficia de `nivel_sla` e da data de resolução. Sugestão: adicionar `nivel_sla`, `prazo_sla` e `data_resolucao` em `tickets`. Enquanto isso, o dashboard calcula o prazo pela prioridade e usa `dataAtualizacao` como data de resolução.
4. **"Devolver à fila"** (`EM_ATENDIMENTO → ABERTO`, citado no RF4 do enunciado) não está nas transições do backend, que usa `PENDENTE` no lugar. A equipe precisa decidir se mantém assim.
5. **Autenticação:** as rotas de status e histórico respondem 401 enquanto o login não for integrado. Nesse período, os testes dessas rotas falham, e isso é esperado.
6. **`GET /api/dashboard`** (no contrato) é opcional: o dashboard calcula tudo a partir de `GET /api/tickets`.

## 5. Decisões técnicas

- **Página própria, sem mexer nas telas dos colegas.** O dashboard tem seus próprios HTML, CSS e JS (`publico/js/dashboard/`) e só aponta para as outras telas. Assim não há conflito de merge e cada módulo continua com seu responsável.
- **A interface não é a dona das regras.** As transições e o cálculo do prazo existem em `regras-ui.js` para mostrar os botões certos e os selos. Quem garante as regras é o backend, que responde 400, 404 ou 409, e a tela mostra a mensagem que vem dele.
- **Transições iguais às do backend** (`statusService.js`), representadas como dados, como sugere o enunciado.
- **"Atenção" com 25% do prazo restante.** O Zendesk usa 15 minutos fixos, mas nossos prazos vão de 4 h a 72 h. Uma porcentagem avisa com antecedência proporcional: 1 h antes para P1 e 18 h antes para P4. O prazo continua contando em `PENDENTE`.
- **SLA vencido calculado na tela**, recalculado a cada 60 s, porque depende da hora atual.
- **Mesma suíte de testes no mock e na API.** O mock não pode "mentir" sobre o comportamento esperado, e a equipe ganha um verificador pronto para o backend.
- **HTML, CSS e JavaScript puros e testes com `node --test`**: nada para instalar, e tudo roda igual em qualquer máquina da equipe.
