# Módulo de Transições de Status e Histórico de Chamados

## 1. Identificação

**Responsável:** Integrante 5

**Módulo:** Transições de Status e Histórico de Chamados

**Tecnologias utilizadas:**
- Node.js
- Express
- PostgreSQL
- JavaScript

## 2. Objetivo

Implementar o controle das alterações de status dos chamados do sistema Help Desk, garantindo que somente as transições permitidas sejam realizadas e que cada alteração seja registrada automaticamente no histórico.

## 3. Status dos chamados

O sistema utiliza os seguintes status:

- ABERTO
- EM_ATENDIMENTO
- PENDENTE
- RESOLVIDO
- FECHADO

## 4. Regras de transição

As transições permitidas são:

| Status anterior | Próximo status permitido |
|---|---|
| ABERTO | EM_ATENDIMENTO |
| EM_ATENDIMENTO | PENDENTE ou RESOLVIDO |
| PENDENTE | EM_ATENDIMENTO ou RESOLVIDO |
| RESOLVIDO | FECHADO |
| FECHADO | Nenhum |

O sistema impede transições não autorizadas pelas regras do módulo.

Chamados com status FECHADO não podem sofrer novas alterações de status.

## 5. Registro do histórico

Sempre que um chamado tem seu status alterado com sucesso, o sistema registra automaticamente:

- Identificador do histórico.
- Identificador do chamado.
- Identificador do usuário responsável.
- Status anterior.
- Novo status.
- Observação, quando informada.
- Data e hora da alteração.

A alteração do status e a inclusão do histórico são executadas dentro de uma transação no PostgreSQL.

Dessa forma, caso ocorra uma falha durante a operação, a transação é desfeita para evitar inconsistências entre o chamado e seu histórico.

## 6. Endpoints implementados

### 6.1 Alteração de status

**Método:** PATCH

**Rota:** `/api/tickets/:id/status`

Exemplo de requisição:

```json
{
  "status": "EM_ATENDIMENTO",
  "observacao": "Chamado assumido para atendimento."
}
```

A observação é opcional.

### 6.2 Consulta do histórico

**Método:** GET

**Rota:** `/api/tickets/:id/history`

Retorna o histórico de alterações do chamado, organizado da alteração mais recente para a mais antiga.

## 7. Validações implementadas

O módulo realiza as seguintes validações:

- Verifica se o identificador do chamado é válido.
- Verifica se o novo status foi informado.
- Verifica se o status pertence à lista definida no contrato da API.
- Verifica se a observação é um texto, quando informada.
- Verifica a existência do chamado.
- Impede transições de status não permitidas.
- Impede alterações em chamados FECHADOS.
- Verifica a presença de um usuário autenticado nas rotas.

As transições inválidas retornam HTTP 409 (Conflict).

Chamados inexistentes retornam HTTP 404 (Not Found).

## 8. Estrutura do banco de dados

O módulo utiliza as seguintes tabelas:

### tickets

Armazena os chamados e seus status atuais.

Campos relevantes:
- `id`
- `status`
- `data_atualizacao`

### ticket_history

Armazena o histórico de alterações dos chamados.

Campos:
- `id`
- `chamado_id`
- `usuario_id`
- `status_anterior`
- `status_novo`
- `observacao`
- `data_alteracao`

A tabela de histórico possui relacionamentos com as tabelas de chamados e usuários.

## 9. Arquivos do módulo

Os principais arquivos implementados são:

- `backend/src/services/statusService.js`: contém as regras de transição, atualização do status e registro e consulta do histórico.
- `backend/src/controllers/ticketsController.js`: realiza as validações das requisições e prepara as respostas da API.
- `backend/src/routes/ticketsRoutes.js`: define as rotas de alteração de status e consulta do histórico.

## 10. Testes realizados

Foram realizados testes com PostgreSQL para verificar:

- Transição de ABERTO para EM_ATENDIMENTO.
- Transição de EM_ATENDIMENTO para PENDENTE.
- Transição de PENDENTE para EM_ATENDIMENTO.
- Transição de EM_ATENDIMENTO para RESOLVIDO.
- Transição de RESOLVIDO para FECHADO.
- Bloqueio de transições inválidas.
- Bloqueio de alterações após o fechamento.
- Registro das alterações no histórico.
- Consulta do histórico de um chamado.

Também foram verificados o funcionamento do servidor Express e a resposta da rota inicial da API.

## 11. Pendências de integração

A autenticação real e a autorização por perfil ainda dependem da integração com o módulo responsável pelo login.

As permissões