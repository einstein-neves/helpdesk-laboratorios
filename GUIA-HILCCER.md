# Guia do módulo de atendimentos

Este guia explica como abrir, testar, entender e apresentar a parte de
gerenciamento e acompanhamento dos atendimentos.

## 1. Abrindo o projeto no VS Code

1. Extraia o arquivo ZIP em uma pasta fácil de encontrar.
2. Abra o VS Code.
3. Clique em **File > Open Folder** ou **Arquivo > Abrir Pasta**.
4. Escolha a pasta `helpdesk-laboratorios` extraída do ZIP.
5. Confirme no canto inferior esquerdo do VS Code que a branch atual é
   `Atendimento-e-Atribuicao`.

No painel Explorer do VS Code, os arquivos do seu módulo estão nestes locais:

```text
helpdesk-laboratorios/
├── GUIA-HILCCER.md
├── docs/
│   └── modulo-atendimentos.md
└── src/
    ├── index.html
    ├── atendimentos.html
    ├── css/
    │   └── atendimentos.css
    └── js/
        ├── atendimentos.js
        └── chamados-service.js
```

## 2. Executando no navegador

### Opção recomendada: Live Server

1. No VS Code, abra a aba de extensões com `Ctrl + Shift + X`.
2. Procure por **Live Server**, de Ritwick Dey.
3. Instale a extensão.
4. No Explorer, clique com o botão direito em `src/index.html`.
5. Escolha **Open with Live Server**.
6. Na página inicial, clique em **Acessar gerenciamento de atendimentos**.

Também é possível abrir `src/index.html` diretamente no navegador. O Live
Server é preferível porque se aproxima mais de como uma aplicação web é
executada em um servidor.

## 3. Roteiro completo de testes

### Teste 1 — Conferir a fila disponível

Ao abrir a página, confirme:

- o técnico conectado aparece como **Hilccer**;
- existem três chamados disponíveis;
- existe um chamado de alta prioridade;
- a ordem inicial é `#1042`, `#1038` e `#1031`.

Essa ordem demonstra a regra `ALTA > MEDIA > BAIXA`.

### Teste 2 — Pesquisa e filtros

1. Digite `projetor` no campo de pesquisa.
2. Confirme que apenas o chamado do projetor aparece.
3. Apague a pesquisa.
4. Escolha a prioridade **Baixa**.
5. Confirme que apenas a instalação do Visual Studio Code aparece.
6. Volte a prioridade para **Todas**.

### Teste 3 — Visualizar os detalhes

1. No chamado `#1042`, clique em **Ver detalhes**.
2. Confira título, descrição, laboratório, categoria, solicitante, data,
   prioridade e responsável.
3. Observe que o responsável aparece como **Aguardando atribuição**.

### Teste 4 — Assumir um chamado

1. Ainda nos detalhes do chamado `#1042`, clique em **Assumir chamado**.
2. Confirme a mensagem de sucesso.
3. O chamado deve desaparecer da fila disponível.
4. O total de disponíveis deve cair de três para dois.
5. O total de seus atendimentos deve subir de dois para três.

### Teste 5 — Acompanhar o atendimento

1. Abra a aba **Meus atendimentos**.
2. Localize o chamado `#1042`.
3. Abra novamente seus detalhes.
4. Confirme que **Hilccer** aparece como técnico responsável.
5. O botão de assumir não deve aparecer novamente.

### Teste 6 — Layout para celular

1. No navegador, pressione `F12`.
2. Ative o modo de dispositivo com `Ctrl + Shift + M`.
3. Escolha um modelo de celular.
4. Confirme que a tabela se transforma em cartões verticais e continua
   utilizável sem precisar ampliar a página.

## 4. Restaurando os dados para repetir os testes

O modo demonstrativo salva os chamados no `localStorage` do navegador. Para
voltar ao estado inicial:

1. Abra a página do módulo.
2. Pressione `F12`.
3. Abra a aba **Application** ou **Aplicativo**.
4. No menu lateral, abra **Local Storage**.
5. Selecione o endereço do Live Server.
6. Apague a chave `helpdesk_chamados`.
7. Atualize a página com `F5`.

Em alguns navegadores, também é possível abrir o Console e executar:

```javascript
localStorage.removeItem("helpdesk_chamados");
location.reload();
```

## 5. Como o código está organizado

### `src/atendimentos.html`

É a estrutura da tela. Contém cabeçalho, indicadores, abas, filtros, tabela,
janela de detalhes e mensagens. Ele define **o que existe na página**.

### `src/css/atendimentos.css`

Controla cores, espaçamentos, tabela, modal e adaptação para celular. Ele define
**como a página aparece**.

### `src/js/chamados-service.js`

É a camada de dados. No modo atual, ela fornece dados demonstrativos e os salva
no navegador. Suas três operações principais são:

- `listarChamados()`;
- `buscarChamado(id)`;
- `atribuirChamado(id, tecnicoId)`.

Essa separação é importante: quando o backend ficar pronto, a interface poderá
continuar igual e o serviço passará a consultar a API.

### `src/js/atendimentos.js`

Controla as ações da tela. As funções mais importantes são:

- `chamadosDaFila()`: separa os disponíveis dos chamados do técnico;
- `aplicarFiltros()`: aplica pesquisa e prioridade;
- `ordenarChamados()`: organiza por prioridade, antiguidade ou data;
- `abrirDetalhes()`: preenche e abre a janela do chamado;
- `assumirChamado()`: solicita a atribuição e atualiza a interface;
- `renderizarLista()`: transforma os dados em linhas visíveis na página.

## 6. Fluxo de uma atribuição

```text
Técnico abre os detalhes
        ↓
Clica em "Assumir chamado"
        ↓
A tela chama atribuirChamado(id, tecnicoId)
        ↓
O serviço verifica se o chamado continua disponível
        ↓
Preenche tecnicoId e muda o status para EM_ATENDIMENTO
        ↓
A tela recarrega as filas e os indicadores
```

A validação impede que o mesmo chamado seja atribuído novamente. No sistema
completo, essa proteção também deverá existir no backend e no banco de dados,
pois dois técnicos podem clicar quase ao mesmo tempo.

## 7. Regras implementadas

Um chamado aparece em **Chamados disponíveis** quando:

```javascript
chamado.status === "ABERTO" && chamado.tecnicoId === null
```

Um chamado aparece em **Meus atendimentos** quando pertence ao técnico atual e
ainda não foi resolvido nem fechado.

A ordem padrão usa o peso da prioridade:

```javascript
ALTA: 3
MEDIA: 2
BAIXA: 1
```

Quando dois chamados possuem a mesma prioridade, o mais antigo aparece
primeiro.

## 8. Integração futura com a equipe

Em `src/js/chamados-service.js`, existe esta configuração:

```javascript
const CONFIGURACAO = {
    usarApi: false,
    baseApi: "/api"
};
```

O valor deve continuar como `false` enquanto não existir backend. Quando as
rotas estiverem funcionando, ele poderá ser alterado para `true`.

O módulo espera estas rotas:

- `GET /api/tickets`;
- `GET /api/tickets/:id`;
- `PATCH /api/tickets/:id/assign`.

Pontos que precisam ser confirmados com a equipe:

- as prioridades serão `ALTA`, `MEDIA` e `BAIXA`;
- a resposta do chamado trará `tecnicoNome`, além de `tecnicoId`;
- atribuir um técnico mudará o status para `EM_ATENDIMENTO`;
- a atribuição e a alteração do status acontecerão juntas no backend;
- o módulo de histórico registrará essa mudança;
- o técnico atual virá do módulo de login, em vez de estar simulado.

## 9. Roteiro curto para apresentar

Você pode explicar assim:

> Minha responsabilidade foi desenvolver o módulo de gerenciamento e
> acompanhamento dos atendimentos. A tela separa os chamados ainda disponíveis
> dos chamados do técnico conectado. A fila é organizada primeiro por
> prioridade e depois por antiguidade. O técnico pode pesquisar, filtrar, abrir
> os detalhes e assumir um chamado. Quando isso acontece, o responsável é
> registrado, o status passa para atendimento e os indicadores são atualizados.
> Eu separei a interface da camada de dados para que os dados demonstrativos
> possam ser substituídos pela API sem refazer toda a tela.

Se perguntarem por que o projeto usa dados demonstrativos:

> O backend e a autenticação ainda não estavam implementados nas branches da
> equipe. Por isso, usei localStorage para tornar o módulo testável agora e
> deixei o serviço preparado para as rotas REST que já estão no contrato do
> projeto.

Se perguntarem sobre dois técnicos assumindo o mesmo chamado:

> A interface já impede uma segunda atribuição nos dados locais. Na integração,
> a verificação também precisa ser atômica no backend para evitar uma condição
> de corrida entre dois técnicos.

## 10. Enviando sua branch ao GitHub

Abra o terminal integrado do VS Code com `Ctrl + '` e execute:

```bash
git status
git branch --show-current
git log --oneline -2
git push -u origin Atendimento-e-Atribuicao
```

O segundo comando deve mostrar `Atendimento-e-Atribuicao`. O GitHub ou o VS
Code poderá pedir que você faça login. Depois do envio, a branch aparecerá na
página do repositório, dentro da lista de branches.

Não envie diretamente para `main`. A integração definida pelo projeto deve ser
feita por Pull Request para `develop`.
