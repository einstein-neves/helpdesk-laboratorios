# Interface, Dashboard e Testes

**Responsável:** Guilherme

Este documento explica a parte de interface, dashboard e testes do Help Desk dos Laboratórios: o que foi feito, como rodar, qual contrato a interface espera do backend e quais decisões tomei.

## 1. O que foi entregue

| Item | Arquivo(s) | Requisitos |
|---|---|---|
| Layout com barra lateral, tema claro/escuro, paleta de comandos (⌘K) e atalhos | `src/index.html`, `src/css/style.css`, `src/js/app.js` | — |
| Dashboard: chamados ativos, SLA vencido, % de cumprimento do SLA, tempo médio de resolução, volume dos últimos 7 dias, ativos por prioridade, chamados em risco e ativos por laboratório | `src/js/app.js`, `src/js/regras-ui.js` | RF6 + extra "contagem por status" |
| Fila em lista, ordenada, com abas por status (Ativos, Todos, cada status, SLA em risco) e busca | `src/js/app.js` | RF3 / CA4 |
| Selos de SLA com contagem regressiva: verde (no prazo), âmbar (menos de 25% do prazo restante) e vermelho (vencido, valor negativo) | `src/js/regras-ui.js` | RF6 |
| Painel lateral de detalhes com barra de progresso do SLA, solução e andamento | `src/js/app.js` | — |
| Botões de ação só para transições válidas | `src/js/regras-ui.js` | RF4 / CA1 |
| Janela que obriga informar a solução ao resolver | `src/index.html`, `src/js/app.js` | RF5 / CA2 |
| Novo chamado em janela, com escolha visual da prioridade e prévia do prazo | `src/js/app.js` | RF1, RF2 / CA3, CA5 |
| Cliente da API + mock para trabalhar sem backend | `src/js/api.js`, `src/js/mock-api.js`, `src/js/config.js` | — |
| Testes unitários + testes de contrato/aceitação | `tests/` | CA1 a CA5 |
| Scripts SQL para testar "SLA vencido" | `tests/sql/` | RF6 |

A tela funciona no celular: abaixo de 860 px a barra lateral vira uma barra no topo e a fila vira cartões.

**Atalhos de teclado:** `C` abre um novo chamado, `⌘K`/`Ctrl+K` ou `/` abre a busca e os comandos, `G` depois `D` vai para o Dashboard, `G` depois `F` vai para a Fila, e `Esc` fecha o painel ou a janela aberta.

### Referências de design

O visual segue padrões das ferramentas de mercado que mais se destacam, sem usar a marca de nenhuma delas:

| Referência | O que adotamos |
|---|---|
| **Linear** | Barra lateral escura e fixa, lista densa com uma linha por chamado, ícones de prioridade em "sinal", paleta de comandos ⌘K, atalhos de uma letra, tema escuro, grade de 4 px e cores fortes só para status e prioridade |
| **Zendesk** | Selos de SLA com contagem regressiva em verde, âmbar e vermelho, com valor negativo quando o prazo vence (ex.: `-2h`) |
| **Dashboards de service desk** (Zendesk, Freshdesk, Geckoboard) | Indicadores de cumprimento do SLA e tempo de resolução, volume por dia, quebra por prioridade e tabela de chamados prestes a vencer |

As cores dos gráficos foram conferidas para pessoas com daltonismo, e cada cor sempre aparece junto de um texto ou legenda.

## 2. Como rodar

**Interface** (precisa de um servidor local, porque o JS usa módulos ES):

```bash
cd src
python -m http.server 5500
# abrir http://localhost:5500
```

Ou `npm start`, que usa o `serve` via npx.

Por padrão a tela abre em **modo demonstração**, com dados de exemplo salvos no navegador. Para usar o backend real:

```
http://localhost:5500/?api=http://localhost:3000/api
```

Também dá para colocar `USE_MOCK: false` e a `API_BASE_URL` em `src/js/config.js`.

**Testes** (Node 18 ou mais novo, sem instalar nenhuma dependência):

```bash
npm test                                            # unitários + métricas + contrato no mock
API_URL=http://localhost:3000/api npm run test:api  # aceitação contra o backend real
npm run test:e2e                                    # ponta a ponta na tela (opcional, ver 4.1)
```

No Windows (PowerShell): `$env:API_URL="http://localhost:3000/api"; npm run test:api`

## 3. Contrato da API que a interface espera

Este é o ponto de integração com o backend. Se o backend seguir este contrato, a tela funciona sem ajustes, e o `npm run test:api` confirma isso.

**Formato do chamado** (mesmos nomes das colunas da tabela `chamados`):

```json
{
  "id": 12,
  "titulo": "Projetor não liga",
  "descricao": "Sem imagem",
  "laboratorio": "Lab 01",
  "prioridade": "P1",
  "status": "aberto",
  "solucao": null,
  "aberto_em": "2026-11-04T19:00:00Z",
  "prazo_sla": "2026-11-04T23:00:00Z",
  "resolvido_em": null
}
```

Datas em ISO 8601 (UTC). A tela converte para o horário local.

| Método | Rota | Corpo | Respostas |
|---|---|---|---|
| GET | `/chamados?status=<opcional>` | — | `200` lista **já ordenada** (prioridade, depois `aberto_em`) |
| POST | `/chamados` | `{titulo, descricao, laboratorio, prioridade}` | `201` chamado criado · `400` dados inválidos (ex.: P7) |
| PATCH | `/chamados/:id/status` | `{status, solucao?}` | `200` chamado atualizado · `400` sem solução ao resolver · `404` não existe · `409` transição inválida |

Os erros vêm como `{ "erro": "mensagem legível" }`, e a tela mostra essa mensagem ao usuário.

Se o backend usar outros nomes de rota, muda só o `src/js/api.js`.

## 4. Testes

### 4.1 Automatizados

- **`tests/unit/regras-ui.test.js`** testa as funções usadas pela tela: cálculo do prazo (incluindo CA3, P1 às 19:00 → 23:00), quando um chamado está com SLA vencido, ordenação da fila, botões disponíveis em cada status, validação do formulário e os números do dashboard.
- **`tests/unit/metricas.test.js`** testa as métricas do dashboard e os selos de SLA: cores verde/âmbar/vermelho, texto curto (`30m`, `3h`, `-2h`), % de cumprimento, tempo médio de resolução, volume por dia, contagem por laboratório e lista de chamados em risco.
- **`tests/contrato.js`** é a suíte de **aceitação CA1 a CA5**, mais o fluxo completo de status e o "devolver à fila". A mesma suíte roda em dois lugares:
  - contra o **mock** (`tests/unit/mock-api.test.js`), o que garante que a tela foi testada com o comportamento certo;
  - contra o **backend real** (`tests/api/aceitacao.test.js`), o que serve de checagem para a equipe antes de integrar.

- **`tests/e2e/fluxos.e2e.js`** é opcional e abre a tela num navegador de verdade (Playwright) para testar: fila ordenada, atender, resolver sem solução (bloqueia) e com solução, abrir chamado e trocar o tema. Para usar: `npm i -D playwright`, depois `npx playwright install chromium`, deixar `python3 -m http.server 5500` rodando dentro de `src` e então `npm run test:e2e`.

Os testes da API criam chamados com o título começando por `[teste]`. Depois, rode `tests/sql/limpar_testes.sql` para apagá-los.

### 4.2 Teste do "SLA vencido" direto no banco (RF6)

Pela API não dá para abrir um chamado no passado. Por isso o enunciado pede inserir um chamado com `aberto_em` antigo direto no banco:

1. Rodar `tests/sql/seed_sla_vencido_postgres.sql` (ou a versão `_azuresql.sql`).
2. O `SELECT` no final do script deve listar só os chamados A e B.
3. Na tela, A e B aparecem em vermelho com "SLA vencido". C (resolvido) e D (no prazo) não aparecem assim.
4. O card "SLA vencido" do dashboard deve aumentar em 2.
5. Tirar print dos passos 2 a 4 para as evidências.

### 4.3 Roteiro de evidências (prints)

| Evidência | Como gerar |
|---|---|
| CA1: `aberto → fechado` → 409 | Saída do `npm run test:api` (teste "CA1"). Na tela o botão nem aparece, por isso a evidência é o teste da API |
| CA2: resolver sem solução → 400 | Saída do teste "CA2" + print do modal bloqueando sem solução |
| CA3: P1 às 19:00 → prazo 23:00 | Saída do `npm test` (teste "CA3") |
| CA4: fila ordenada | Abrir um P3, depois um P1, e tirar print da aba **Fila** com o P1 acima |
| CA5: prioridade P7 → 400 | Saída do teste "CA5" |
| RF6: SLA vencido | Roteiro da seção 4.2 |

## 5. Decisões técnicas

- **Visual inspirado em ferramentas de mercado** (ver "Referências de design"). Copiamos padrões que os usuários já conhecem, não a marca: o técnico bate o olho na fila e vê na hora o que está vencendo.
- **"Atenção" com 25% do prazo restante.** O Zendesk usa 15 minutos fixos, mas nossos prazos vão de 4 h a 72 h. Uma porcentagem avisa com antecedência proporcional: 1 h antes para um P1 e 18 h antes para um P4.
- **A fila abre em "Ativos".** Quem atende precisa ver o que ainda falta fazer. Os chamados finalizados continuam nas abas "Todos", "Resolvido" e "Fechado".
- **HTML, CSS e JavaScript puros, sem framework.** A tela é pequena, não precisa de etapa de build e é servida como arquivos estáticos (no próprio App Service ou em Static Web Apps). Todos da equipe conseguem ler o código.
- **A interface não é a dona das regras.** As transições e o cálculo do prazo existem em `regras-ui.js` apenas para a tela mostrar os botões certos e a prévia do prazo. Quem garante as regras é o backend, que valida de novo e responde 400 ou 409. Se a tela e o backend discordarem, vale o backend, e a tela mostra o erro.
- **Transições representadas como dados** (`{ aberto: ['em_atendimento'], ... }`), como sugere o enunciado. Com isso, decidir se um botão aparece é uma linha de código.
- **"SLA vencido" calculado na tela a partir de `prazo_sla`.** O vencimento depende da hora atual, então a tela recalcula a cada 60 s sem recarregar a página. O backend só precisa gravar o `prazo_sla` na abertura.
- **Mock com o mesmo contrato da API.** Permitiu desenvolver e testar a interface antes do backend existir. A mesma suíte de testes roda no mock e na API, então não há como o mock "mentir" sobre o comportamento esperado.
- **Testes com o test runner nativo do Node** (`node --test`): não há nada para instalar, e eles rodam igual em qualquer máquina da equipe.
