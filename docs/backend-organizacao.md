# Backend: banco, identidade e permissões

## Instalação inicial

Requer Node.js 22 ou superior. O banco usa PostgreSQL do Supabase e a
autenticação usa Supabase Auth. Não armazenamos senhas em `public.users`.

```powershell
cd backend
npm install
npm run db:check
npm run db:setup
npm run db:migrate
npm run build:client
npm test
npm start
```

`db:setup` executa `database/schema.sql` em uma transação. É um instalador para
banco novo: se as tabelas já existem, falha sem apagá-las. Alterações futuras
devem ser scripts versionados de migração, sem recriar o schema.
Em um banco com as tabelas já criadas, execute apenas `db:migrate`, nunca
reaplique `db:setup`. A migração de SLA é versionada e não apaga chamados.

Preencha `DATABASE_URL`, `DB_SSL_CA_PATH`, `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY` no `.env`. A secret key não é necessária para
validar os tokens de usuários. `CORS_ORIGINS` pode conter origens de frontend
separadas por vírgula; sem essa variável, use o frontend na mesma origem.

## Cadastro e login

1. Abra `/login.html`, clique em Criar uma conta e confirme o e-mail recebido.
   A tela usa o SDK Supabase com renovação automática e botão Sair.
2. Envie `Authorization: Bearer ACCESS_TOKEN` nas requisições à API Express.
   Publishable key, secret key e refresh token não são access tokens.
3. Complete o perfil com `POST /api/users/me`, corpo `{"nome":"Seu nome"}`.
   A identidade e o e-mail vêm do Supabase; o perfil inicial é SOLICITANTE.
4. Um administrador pode promover ou desativar usuários. Nenhum perfil é
   lido dos metadados modificáveis pelo usuário ou do corpo do cadastro.

Para criar o primeiro administrador, crie a conta pela tela e confirme o
e-mail. Na pasta `backend`, execute:

```powershell
npm run admin:bootstrap -- seu-email@exemplo.com
```

O comando exige acesso SQL ao servidor e uma identidade Auth confirmada.
Ele não envia e-mail, não pede senha e só funciona quando ainda não existe
administrador ativo. Não existe uma rota pública de promoção. Também é
possível promover um perfil existente manualmente no SQL Editor:

```sql
UPDATE public.users
SET perfil = 'ADMIN', atualizado_em = NOW()
WHERE auth_user_id = 'UUID_DA_CONTA_CONFIRMADA';
```

A API valida o token no servidor Auth a cada requisição e consulta o perfil
ativo no PostgreSQL. A desativação impede a próxima requisição, inclusive
com token ainda válido. Logout e renovação são feitos no Supabase Auth;
não existe um endpoint local de emissão de senha/token.

## Matriz de acesso

| Operação | Solicitante | Atendente | Técnico | Admin |
|---|---|---|---|---|
| Abrir chamado | Sim | Sim | Sim | Sim |
| Consultar chamado/histórico | Próprios | Todos | Próprios, atribuídos e fila aberta sem técnico | Todos |
| Atribuir chamado aberto | Não | A técnico ativo | Somente a si | A técnico ativo |
| Alterar status | Não | Não | Atribuídos a si | Todos |
| Listar/alterar usuários | Não | Não | Não | Sim |

As transições de status continuam regidas por `statusService.js`. Atribuição
só é permitida para chamado ABERTO sem técnico e gera histórico na mesma
transação. A API não oferece exclusão de usuários ou chamados para preservar
as referências do histórico. Admin não pode desativar ou rebaixar a si mesmo.

## Rotas implementadas

Todas exigem access token válido e e-mail confirmado. Só o cadastro de perfil
aceita usuário Auth sem perfil local. Listagens retornam até 50 itens, com
paginação por `?offset=50`.

| Método | Rota | Função |
|---|---|---|
| GET | `/api/config` | Configuração pública: apenas URL e publishable key; não exige token |
| POST | `/api/users/me` | Completar perfil, aceitando apenas nome |
| GET | `/api/users/me` | Consultar perfil atual |
| GET | `/api/auth/me` | Consultar perfil atual (alias) |
| GET | `/api/users` | Listar usuários, restrito a admin |
| GET | `/api/users/technicians` | Listar IDs e nomes de técnicos ativos, restrito a atendente/admin |
| PATCH | `/api/users/:id` | Alterar `perfil` e/ou `ativo`, restrito a admin |
| POST | `/api/tickets` | Abrir chamado com solicitante derivado do token |
| GET | `/api/tickets` | Listar chamados permitidos |
| GET | `/api/tickets/:id` | Consultar chamado permitido |
| PATCH | `/api/tickets/:id/assign` | Atribuir com `{"tecnicoId":123}` ou assumir como técnico |
| PATCH | `/api/tickets/:id/status` | Atualizar com `status` e `observacao` opcional |
| GET | `/api/tickets/:id/history` | Consultar histórico permitido |

## Estrutura

- `src/app.js`: configuração Express, CORS, JSON, rotas e tratamento de erros.
- `src/server.js`: porta HTTP e encerramento das conexões.
- `src/config/`: banco, chaves Supabase e regras centrais de permissão.
- `src/middlewares/auth.js`: validação de identidade, perfil ativo e acesso por perfil.
- `src/routes/`: associação entre endpoints, permissões e controladores.
- `src/controllers/`: validação HTTP e operações de chamados/usuários.
- `src/services/statusService.js`: transação de status e histórico com autorização.
- `src/utils/http.js`: validações e formato de resposta.
- `src/scripts/`: instalação explícita do schema.
- `test/`: testes de permissões e API com dependências simuladas.

RLS fica habilitado sem políticas públicas e os privilégios das roles
`anon` e `authenticated` são revogados nas tabelas da aplicação. O Express
usa conexão SQL privilegiada e aplica a autorização; não dê a URL SQL ao
frontend. Uma futura role SQL dedicada precisará dos privilégios e da
estratégia RLS apropriados antes de substituir a conexão atual.

## Frontend integrado

O frontend usa a API real; chamados e identidades simulados foram removidos.
`/index.html` exige login; `/abertura.html` abre solicitações;
`/atendimentos.html` apresenta filas, atribuição, status e histórico conforme
o perfil; `/usuarios.html` permite ao admin alterar perfis e ativar/desativar
contas. A API sempre reaplica as permissões, independentemente da interface.

A sessão do SDK fica em `sessionStorage`, isolada por aba, com renovação
automática. O backend valida o access token recebido em cada requisição.
Em computadores compartilhados, use Sair ao terminar. A secret key nunca
é incluída no bundle nem retornada por `/api/config`.

O bundle servido é `publico/js/auth.bundle.js`, gerado a partir de
`backend/client/auth.js`. Após alterar a fonte, execute `npm run build:client`.
`npm run dev` recompila ao iniciar; reinicie-o após mudar essa fonte.
O bundle está incluído para que `npm start` também funcione com as
dependências apenas de produção instaladas.

Configure no Supabase Auth > URL Configuration o Site URL e a lista de
redirect URLs para a origem usada (por exemplo,
`http://localhost:3001/login.html` no desenvolvimento). Em produção, use HTTPS.
Se a porta 3000 já estiver ocupada, defina `PORT=3001` no `.env`.

O prazo SLA é calculado pelo PostgreSQL a partir do nível validado no backend:
P1 = 4 h, P2 = 8 h, P3 = 24 h e P4 = 72 h. Identidade do solicitante, status
inicial e prazo enviados pelo navegador não são usados como autoridade.

## Validação

`npm test` executa testes de autorização, API, transações e telas em DOM
simulado. `npm run test:integration` é explícito: cria cinco contas Auth
temporárias confirmadas sem enviar e-mails, testa login/renovação/logout,
chamados e permissões no Supabase configurado e remove os registros criados.
Requer secret key e conexão SQL privilegiada; não é executado por `npm test`.
Se houver falha de rede na limpeza, revise os registros identificados pelo
prefixo `hd-` e pelo título `Integração temporária` antes de repetir o teste.

Referência: https://supabase.com/docs/guides/auth
