# PostgreSQL remoto no Supabase

O backend usa `pg` e SQL e valida access tokens do Supabase Auth.
Consulte [Organização do backend](backend-organizacao.md) para criação do
schema, cadastro de perfis, regras de acesso e integração do frontend.

## Chaves de API

Preencha no `backend/.env`:

```dotenv
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
SUPABASE_SECRET_KEY=sb_secret_SUBSTITUA
```

Copie os valores reais do painel do projeto, em Settings > API Keys.
A publishable key identifica a aplicação e pode ser usada no navegador,
mas não autentica o usuário nem substitui políticas RLS.
A secret key tem privilégios elevados e deve permanecer somente no backend.
Ela não é uma senha de usuário nem um segredo de assinatura JWT.
Não é necessário copiar JWT signing keys para preparar esta conexão.

`src/config/supabase.js` carrega e valida a configuração sob demanda:

```js
const { getSupabaseConfig, getPublicSupabaseConfig } = require("./config/supabase");
const publicConfig = getPublicSupabaseConfig(); // URL + publishable key
const adminConfig = getSupabaseConfig({ admin: true }); // somente uso interno
```

`GET /api/config` publica somente URL e publishable key para o SDK do frontend.
A secret key não é retornada. Use a configuração adequada à operação e nunca
retorne `adminConfig` em respostas ou logs.
As variáveis legadas `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são
alternativas opcionais; as novas chaves têm precedência. Não preencha ambas
as versões sem necessidade. O backend SQL continua usando `DATABASE_URL`,
que contém a senha PostgreSQL, e não as chaves de API.

Referência: https://supabase.com/docs/guides/getting-started/api-keys

## Configuração

1. Na pasta `backend`, copie `.env.example` para `.env`.
2. No painel do projeto Supabase, abra **Connect** e copie a URI de
   **Session pooler** (porta 5432). Esse modo atende ao backend Express
   persistente e oferece conectividade IPv4. A conexão direta exige uma rede
   compatível com o endereço fornecido pelo projeto.
3. Preencha `DATABASE_URL` com a URI e a senha do banco. Caracteres especiais
   da senha precisam de percent-encoding. Nunca coloque essa URI no frontend,
   em commits ou mensagens de erro.
4. Mantenha `DB_SSL=true`. A conexão verifica o certificado e o hostname.
   Se a cadeia exigir o certificado raiz do projeto, baixe-o nas configurações
   do banco e informe `DB_SSL_CA_PATH`. Caminhos relativos partem de `backend`.
   Parâmetros SSL da URI são removidos para preservar essa validação explícita.
5. Em um banco novo, execute `backend/database/schema.sql` pelo SQL Editor
   do Supabase. O script cria tabelas e não é uma migração idempotente:
   não execute novamente sobre tabelas existentes.
6. Na pasta `backend`, execute `npm install`, `npm run db:check` e `npm start`.
   O check é somente leitura e retorna código diferente de zero quando falha.

O `.env` é carregado da pasta `backend`, independentemente do diretório de
execução. Variáveis definidas no ambiente da hospedagem têm precedência.
`DATABASE_URL` tem precedência sobre `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`
e `DB_PASSWORD`. Com uma URL, TLS fica habilitado por padrão; para banco local,
remova a URL e use as variáveis locais do exemplo com `DB_SSL=false`.
O pool abre no máximo cinco conexões por processo e aguarda até dez segundos
para obter uma conexão.

## Acesso às tabelas

O frontend deve acessar o banco pela API Express. As tabelas do esquema
`public` podem ficar disponíveis pela Data API do Supabase dependendo da
configuração do projeto. Se a aplicação usa apenas Express, desabilite a
Data API ou configure RLS e os privilégios para impedir acesso por `anon`
e `authenticated`. Não crie políticas públicas de leitura/escrita como atalho.
A conexão privilegiada do backend exige autorização no Express; RLS não
substitui as verificações de perfil e propriedade dos chamados nesse fluxo.
Para implantação, prefira uma role dedicada com os privilégios necessários.

Documentação: https://supabase.com/docs/guides/database/connecting-to-postgres
