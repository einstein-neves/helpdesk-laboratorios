# Contratos de Integração — Help Desk

## 1. Padrões gerais

- A comunicação será feita por API REST.
- Os dados serão enviados e recebidos em JSON.
- Os identificadores serão chamados de `id`.
- Os nomes dos campos devem seguir o padrão definido neste documento.
- Datas devem utilizar o formato ISO 8601.
- Todas as rotas protegidas deverão verificar a autenticação e a permissão do usuário.

## 2. Entidade: Usuário

Campos:
- id
- nome
- email
- senha (armazenada com hash, nunca em texto puro)
- perfil
- ativo

Perfis iniciais propostos:
- SOLICITANTE
- ATENDENTE
- TECNICO
- ADMIN

## 3. Entidade: Chamado

Campos:
- id
- titulo
- descricao
- laboratorio
- categoria
- prioridade
- status
- solicitanteId
- tecnicoId
- dataAbertura
- dataAtualizacao

## 4. Status permitidos

- ABERTO
- EM_ATENDIMENTO
- PENDENTE
- RESOLVIDO
- FECHADO

Toda mudança de status deve gerar um registro no histórico.

## 5. Histórico

Campos:
- id
- chamadoId
- usuarioId
- statusAnterior
- statusNovo
- observacao
- dataAlteracao

## 6. Formato padrão de resposta

Sucesso:

{
  "success": true,
  "data": {},
  "message": "Operação realizada com sucesso."
}

Erro:

{
  "success": false,
  "data": null,
  "message": "Não foi possível realizar a operação."
}

## 7. Rotas planejadas

POST /api/auth/login

POST /api/users

GET /api/users

POST /api/tickets

GET /api/tickets

GET /api/tickets/:id

PATCH /api/tickets/:id/assign

PATCH /api/tickets/:id/status

GET /api/tickets/:id/history

GET /api/dashboard

## 8. Regras de integração

1. Não alterar nomes de campos sem comunicar a equipe.
2. Não criar status diferentes dos definidos.
3. Toda alteração deve passar por Pull Request.
4. A branch develop será usada para integração.
5. A branch main receberá apenas versões estáveis.
6. Alterações no banco de dados devem ser documentadas e compartilhadas.
