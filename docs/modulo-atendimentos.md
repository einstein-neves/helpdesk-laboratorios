# Módulo de gerenciamento de atendimentos

Responsável: Hilccer

## Escopo entregue

- Listagem dos chamados abertos e ainda sem técnico responsável.
- Visualização dos detalhes de cada chamado.
- Atribuição de um chamado ao técnico conectado.
- Exibição do nome do técnico responsável.
- Ordenação da fila por prioridade e, em caso de empate, por antiguidade.
- Filtros por texto e prioridade.
- Fila separada para acompanhar os chamados do técnico conectado.

## Como executar

O projeto ainda não possui servidor ou processo de build. Para testar localmente,
abra `src/index.html` no navegador e acesse o link **Gerenciamento de atendimentos**.

Os dados de demonstração ficam no `localStorage` do navegador. A configuração
`CONFIGURACAO.usarApi`, em `src/js/chamados-service.js`, deve permanecer como
`false` até o backend estar disponível.

## Integração com a API

O módulo segue as rotas definidas em `docs/contratos-api.md`:

- `GET /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/assign`

Corpo enviado na atribuição:

```json
{
  "tecnicoId": 4
}
```

Quando o backend estiver pronto, altere `CONFIGURACAO.usarApi` para `true`. As
respostas devem seguir o formato padrão do contrato e devolver o chamado em
`data`.

## Decisões e dependências entre módulos

1. A fila disponível considera apenas chamados com `status` igual a `ABERTO` e
   `tecnicoId` igual a `null`.
2. Ao assumir um chamado, o backend deve preencher `tecnicoId`, alterar o status
   para `EM_ATENDIMENTO` e registrar a transição no histórico. Essa operação deve
   ser atômica para impedir que dois técnicos assumam o mesmo chamado.
3. Além de `tecnicoId`, as respostas de chamado devem incluir `tecnicoNome` ou um
   objeto equivalente. Sem esse dado, a interface não consegue identificar o
   responsável sem realizar outra consulta.
4. A implementação atual usa as prioridades `ALTA`, `MEDIA` e `BAIXA`. A equipe
   deve confirmar e documentar esses mesmos valores no contrato da API.
5. O técnico conectado está temporariamente simulado no serviço. Ele deverá ser
   substituído pelo usuário autenticado fornecido pelo módulo de login.
6. A alteração manual dos demais status não faz parte deste módulo; ela pertence
   ao módulo de transições de status e histórico.
