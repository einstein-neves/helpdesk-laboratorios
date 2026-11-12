# Help Desk dos Laboratórios — Guia técnico do projeto

Projeto Integrador de Análise e Desenvolvimento de Sistemas. Este documento
consolida arquitetura, execução, autenticação, API, fluxo de chamados,
dashboard, testes, responsabilidades da equipe e colaboração.

## 1. Visão geral

O sistema organiza solicitações de suporte dos laboratórios: cadastro de
usuários, abertura de chamados, atribuição a técnicos, transições de status,
histórico e indicadores. O backend é a autoridade para autenticação,
autorização, SLA e persistência no modo integrado.

Há dois modos de execução:

| Modo | Uso | Persistência |
|---|---|---|
| Demo local | Apresentação e desenvolvimento sem serviços externos | Memória do processo; reinicia ao parar o servidor |
| Integrado | Uso com Supabase Auth e PostgreSQL | Banco PostgreSQL do projeto |

O arquivo `backend/.env` existente nesta máquina ativa o modo demo. A senha
local correspondente está em `docs/ACESSO-DESENVOLVEDOR.local.md`; esse arquivo
é ignorado pelo Git e não deve ser compartilhado.

## 2. Estrutura atual

```text
backend/
  client/       Fonte do cliente de autenticação do navegador
  database/     Schema, migrações e scripts SQL de apoio (seeds/)
  src/
    app.js      Configuração Express, configuração pública e arquivos estáticos
    index.js    Inicialização HTTP e encerramento do pool
    config/     PostgreSQL, Supabase e permissões
    demo/       Autenticação local e API de demonstração em memória
    middlewares/Autenticação e autorização
    routes/     Rotas públicas e protegidas
    controllers/Operações de chamados
    services/   Regras de status e histórico
    utils/      Validação e envelope JSON
  test/         Testes de API, interface, permissões, status e modo demo
publico/        Interface integrada servida pelo Express
docs/           Este guia consolidado
```

`publico/` é o único frontend estático da aplicação e é servido pelo Express.
O `package.json` da raiz encaminha os comandos de início e teste para
`backend/`; as dependências e o lockfile da aplicação ficam nesse diretório.

## 3. Executar a aplicação

### 3.1 Demo local

Requer Node.js 22 ou superior. Em uma máquina nova, copie
`backend/.env.example` para `backend/.env`. A configuração demo define
`NODE_ENV=development`, `DEMO_MODE=true`, a conta e a porta. Inicie na raiz:

```powershell
npm start --prefix backend
```

Abra http://127.0.0.1:3000/login.html. O servidor também imprime o e-mail e a
senha no terminal. Use o arquivo local ignorado do Git se precisar consultar a
senha novamente. O modo demo:

- exige a porta `3000` no endereço; `http://127.0.0.1/` sem porta tenta acessar
  a porta 80. Se `PORT` tiver outro valor, use a URL informada pelo servidor;
- só inicia com `NODE_ENV=development`;
- vincula o servidor a `127.0.0.1`;
- usa o perfil `ADMIN` de demonstração e um técnico fictício;
- oferece dados de exemplo e o fluxo de abertura, atribuição, status e histórico;
- não acessa Supabase ou PostgreSQL;
- perde alterações e sessões quando o processo reinicia.

Não habilite `DEMO_MODE` em hospedagem ou ambiente de produção. Para desativar
o modo, defina `DEMO_MODE=false` no ambiente local e configure o Supabase e o
banco conforme a seção 5.

### 3.2 Supabase e PostgreSQL

No modo integrado, `backend/.env` precisa conter as configurações reais:

```dotenv
DEMO_MODE=false
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/postgres
DB_SSL=true
DB_SSL_CA_PATH=certs/supabase-ca.crt
```

Use os valores do painel do projeto. Caracteres especiais da senha do banco
precisam de percent-encoding na URI. Não coloque credenciais no frontend,
documentação versionada, logs ou commits. `SUPABASE_SECRET_KEY` não é
necessária para login e não deve ser publicada.

Instalação e inicialização do backend:

```powershell
Set-Location .\backend
npm install
npm run build:client
npm run db:check
npm run db:migrate
npm start
```

O servidor integrado atende na porta 3000 por padrão. Pode-se definir `PORT`
no ambiente. O frontend está disponível em `/login.html` e a checagem de
disponibilidade em `/api/health`.

Para um banco novo, `npm run db:setup` aplica `database/schema.sql`. É um
instalador e não deve ser repetido sobre tabelas existentes. Para atualizações
de schema, use migrações versionadas.

No Supabase, configure o Site URL e as URLs de redirecionamento do Auth. A
identidade é validada pelo Supabase Auth e o perfil local reside em
`public.users`, ligado por `auth_user_id`. O primeiro administrador integrado
é criado pelo comando `npm run admin:bootstrap -- email@exemplo.com`, depois
de a conta Auth confirmar o e-mail e somente se ainda não houver admin ativo.

## 4. Conta de desenvolvimento e segurança

O login local é `desenvolvedor@localhost.test`; a senha aleatória está somente
em `backend/.env` e no documento local ignorado
`docs/ACESSO-DESENVOLVEDOR.local.md`. O servidor a exibe no terminal ao iniciar
o modo demo.

`/api/config` publica somente o modo e o e-mail demo. A senha não é enviada ao
navegador. O backend gera um token de sessão aleatório a cada inicialização,
aceita-o apenas no modo demo local e invalida as sessões ao encerrar o
processo. Os dados fictícios ficam em memória e não são gravados no banco.

O `.gitignore` exclui `node_modules`, arquivos `.env`, arquivos temporários do
sistema e o documento de credenciais. Antes de compartilhar ou versionar
alterações, confira `git status` e `git check-ignore`.

## 5. Autenticação e autorização no modo integrado

1. `GET /api/config` retorna apenas a URL Supabase e a publishable key.
2. `POST /api/usuarios` encaminha nome, e-mail e senha ao Supabase Auth. Retorna
   `201` em JSON. Se a confirmação de e-mail estiver habilitada, a sessão pode
   ser nula até a confirmação.
3. `POST /api/login` autentica e retorna `200` com a sessão Supabase.
4. O SDK do navegador instala e renova a sessão.
5. O backend valida o access token e consulta o perfil ativo no PostgreSQL.
   `POST /api/users/me` completa o perfil local; seu papel inicial é
   `SOLICITANTE`.

As senhas não são armazenadas em `public.users`. Perfil e identidade não são
aceitos dos metadados modificáveis nem do corpo de cadastro. Logout remove a
sessão local do navegador.

| Operação | SOLICITANTE | ATENDENTE | TÉCNICO | ADMIN |
|---|---:|---:|---:|---:|
| Abrir chamado | Sim | Sim | Sim | Sim |
| Consultar chamados | Próprios | Todos | Próprios, atribuídos e fila aberta | Todos |
| Atribuir chamado aberto | Não | A técnico ativo | Somente a si | A técnico ativo |
| Alterar status | Não | Não | Atribuídos a si | Todos |
| Gerenciar usuários | Não | Não | Não | Sim |

A API reaplica permissões em cada operação, mesmo quando a interface oculta
botões. Usuários inativos não acessam as rotas protegidas. O admin não pode
rebaixar ou desativar a própria conta.

## 6. Contrato das respostas e rotas

Respostas bem-sucedidas usam o envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Operacao realizada com sucesso."
}
```

Erros usam `success: false`, `data: null` e uma mensagem. Rotas desconhecidas
da API retornam JSON 404, não HTML. Datas são ISO 8601.

| Método | Rota | Acesso / finalidade |
|---|---|---|
| GET | `/api/health` | Pública; status do servidor |
| GET | `/api/config` | Pública; configuração mínima para o cliente |
| POST | `/api/usuarios` | Pública no modo integrado; cadastro Supabase |
| POST | `/api/login` | Pública; autenticação |
| POST / GET | `/api/users/me` | Perfil local da sessão autenticada |
| GET | `/api/auth/me` | Alias do perfil atual |
| GET | `/api/users` | Admin; lista paginada |
| GET | `/api/users/technicians` | Atendente/Admin; técnicos ativos |
| PATCH | `/api/users/:id` | Admin; altera perfil ou situação |
| POST | `/api/tickets` | Abre chamado |
| GET | `/api/tickets?offset=0` | Lista até 50 chamados autorizados |
| GET | `/api/tickets/:id` | Consulta chamado autorizado |
| PATCH | `/api/tickets/:id/assign` | Atribui técnico a chamado aberto |
| PATCH | `/api/tickets/:id/status` | Atualiza status |
| GET | `/api/tickets/:id/history` | Consulta histórico autorizado |

No modo demo, o login e as rotas protegidas usam dados em memória e mantêm o
mesmo formato básico de resposta. A tela de cadastro de contas fica oculta.

## 7. Chamados, SLA, status e histórico

Chamados contêm título, descrição, laboratório, categoria, prioridade, status,
solicitante, técnico e datas de abertura/atualização. Solicitante, status
inicial e prazo são determinados pelo backend, não pelo navegador.

| Nível SLA | Prioridade | Prazo |
|---|---|---:|
| P1 | ALTA | 4 horas |
| P2 | ALTA | 8 horas |
| P3 | MEDIA | 24 horas |
| P4 | BAIXA | 72 horas |

O SLA é calculado a partir da abertura. A fila pode ser filtrada e ordenada por
prioridade e antiguidade. A atribuição só aceita chamados abertos ainda sem
técnico, muda o status para `EM_ATENDIMENTO` e registra o evento.

Transições permitidas:

| Status atual | Próximos status |
|---|---|
| ABERTO | EM_ATENDIMENTO |
| EM_ATENDIMENTO | PENDENTE, RESOLVIDO |
| PENDENTE | EM_ATENDIMENTO, RESOLVIDO |
| RESOLVIDO | FECHADO |
| FECHADO | Nenhum |

Cada transição registra chamado, usuário, status anterior e novo, observação e
data. No PostgreSQL, atualização e histórico são uma transação. No demo, ambos
atualizam o estado em memória. A observação da API é opcional; a interface do
dashboard exige solução ao resolver, portanto essa regra de interface não deve
ser confundida com uma validação já imposta pelo backend integrado.

### Roteiro de apresentação do modo demo

1. Entre com a conta local do desenvolvedor.
2. Abra um chamado e confira o SLA calculado.
3. Em **Chamados**, abra um chamado disponível e atribua o técnico de
   demonstração.
4. Consulte o histórico e percorra `EM_ATENDIMENTO`, `PENDENTE`,
   `EM_ATENDIMENTO`, `RESOLVIDO` e `FECHADO`.
5. Reinicie o servidor para restaurar os dados de exemplo.

## 8. Interface e dashboard

O frontend integrado está em `publico/`: `login.html`, `index.html`,
`abertura.html`, `atendimentos.html`, `usuarios.html` e `dashboard.html`.
`publico/js/chamados-service.js` concentra as requisições da abertura e dos
atendimentos. O bundle servido é `publico/js/auth.bundle.js`, compilado de
`backend/client/auth.js` com `npm run build:client`.

O dashboard de `publico/dashboard.html` usa, por padrão, a API do sistema com
a sessão do login, portanto mostra os mesmos chamados das telas de abertura e
atendimentos. Para demonstrar a interface com dados de exemplo guardados no
`localStorage` do navegador, abra `dashboard.html?mock=1`; esses dados são
separados dos chamados reais e não são persistidos no backend.

O dashboard reúne indicadores de chamados ativos, SLA vencido,
cumprimento de SLA, tempo médio de resolução, volume semanal, prioridade,
laboratório e chamados em risco. A interface é responsiva, inclui filtros,
detalhes e atalhos de teclado. As métricas da interface são auxiliares;
as regras de negócio válidas devem ser conferidas na API.

Todas as telas autenticadas compartilham o mesmo layout: `publico/js/layout.js`
monta o menu lateral (a lista de itens fica na constante `ITENS`) e
`publico/css/layout.css` define o tema único, o cabeçalho de página
(`.hd-page-header`) e o espaçamento do conteúdo (`.hd-content`). Uma tela nova
só precisa de `<body class="pagina-interna" data-pagina="...">`, do script
`js/layout.js` como primeiro elemento do `body` e de `css/layout.css` como
última folha de estilo. Não há alternância de tema claro/escuro.

## 9. Estrutura do banco e integração

O schema PostgreSQL inclui usuários, chamados e `ticket_history`. Use
`backend/database/schema.sql` apenas para instalar um banco novo. Migrações
subsequentes ficam em `backend/database/migrations/`.

O backend usa `pg` com pool limitado e TLS validado quando configurado. A
Data API do Supabase não deve permitir leitura/escrita pública das tabelas do
aplicativo. Não crie políticas RLS abertas como atalho. O Express autentica e
autoriza antes do acesso SQL; uma eventual role SQL dedicada deve receber
somente os privilégios necessários.

## 10. Testes e comandos

Na raiz, o comando delega para a suíte do backend:

```powershell
npm test
```

Na aplicação integrada:

```powershell
npm run build:client --prefix backend
npm test --prefix backend
```

Os testes cobrem rotas, cadastro/login Supabase simulados, autorização,
transições, histórico, telas e o fluxo demo sem serviços externos.

`npm run test:integration --prefix backend` acessa serviços Supabase/PostgreSQL
configurados e cria contas temporárias para validar integração. Execute apenas
com uma configuração de teste autorizada e confira o resultado de limpeza.
Não é parte da suíte local padrão.

## 11. Organização e colaboração

Responsabilidades originais informadas pela equipe:

| Integrante | Responsabilidade |
|----------|------------------------------------------------------|
| Einstein | Liderança, arquitetura, Git e integração dos módulos |
| Arthur | Login, usuários e permissões --------------------------|
| Alexcia | Abertura e cadastro de chamados ----------------------|
| Hilccer | Atendimento e atribuição de técnicos -----------------|
| Matheus | Transições de status e histórico ---------------------|
| Guilherme | Interface, dashboard e testes ----------------------|

Use branches focadas, commits descritivos e Pull Requests revisados. Antes de
integrar, confira staged e unstaged separadamente, rode os testes relevantes e
verifique que nenhum `.env`, senha ou credencial local será enviado. Não use
`git add .` sem revisar o que será incluído.
