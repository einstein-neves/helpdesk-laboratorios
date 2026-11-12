# 🎫 Help Desk — Sistema de Gerenciamento de Chamados

## 📌 Sobre o Projeto

O **Help Desk dos Laboratórios** é um sistema desenvolvido para facilitar o gerenciamento de chamados de suporte técnico, permitindo que usuários registrem solicitações, acompanhem atendimentos e consultem o histórico de suas ocorrências.

O sistema busca organizar o fluxo de atendimento, melhorar a comunicação entre usuários e técnicos e proporcionar maior controle sobre as solicitações.

## 👥 Equipe e Divisão de Responsabilidades

O desenvolvimento é dividido entre os integrantes da equipe, com responsabilidades específicas para cada funcionalidade.

| Integrante | Responsabilidade |
|---|---|
| **1. Einstein** | Líder do projeto, gerenciamento do GitHub, arquitetura e integração dos módulos. |
| **2. Arthur** | Desenvolvimento do login, gerenciamento de usuários e permissões de acesso. |
| **3. Alexcia** | Desenvolvimento da abertura e do cadastro de chamados. |
| **4. Hilccer** | Desenvolvimento do atendimento e atribuição de técnicos aos chamados. |
| **5. Matheus** | Implementação das transições de status e do histórico dos chamados. |
| **6. Guilherme** | Desenvolvimento da interface, dashboard e realização de testes. |

## ⚙️ Funcionalidades do Sistema

- 🔐 Login e autenticação de usuários.
- 👤 Cadastro e gerenciamento de usuários.
- 📝 Abertura e registro de chamados.
- 🛠️ Atendimento e atribuição de técnicos.
- 🔄 Controle de status dos chamados.
- 📋 Histórico de atendimentos e alterações.
- 📊 Dashboard para visualização de informações.
- 🧪 Testes e validação das funcionalidades.

## 🔄 Fluxo de Funcionamento

1. O usuário realiza o login no sistema.
2. O usuário abre um novo chamado.
3. O chamado é registrado no sistema.
4. Um técnico é atribuído para realizar o atendimento.
5. O status do chamado é atualizado conforme o andamento.
6. O sistema registra as alterações no histórico.
7. O usuário pode acompanhar o andamento da solicitação.

## 🚀 Como Executar

Requer Node.js 22 ou superior.

```powershell
npm install --prefix backend
Copy-Item backend\.env.example backend\.env   # defina DEMO_PASSWORD
npm start
```

Abra http://127.0.0.1:3000/login.html. No modo demo local, o e-mail e a senha
aparecem no terminal; os dados ficam em memória e reiniciam junto com o
servidor. A configuração com Supabase e PostgreSQL está descrita no
[guia técnico](docs/GUIA-PROJETO.md).

Para rodar os testes:

```powershell
npm test
```

## 🧑‍💻 Organização do Desenvolvimento

Cada integrante é responsável pelo desenvolvimento e pela manutenção do seu respectivo módulo.

A integração é realizada de forma conjunta, seguindo a arquitetura definida pela liderança do projeto.

### 📌 Padrões de colaboração

- Utilizar branches para organizar o desenvolvimento.
- Realizar commits com mensagens claras.
- Evitar alterações diretamente na branch principal (`main`).
- Revisar e testar as funcionalidades antes da integração.
- Manter o código organizado e documentado.
- Comunicar possíveis conflitos e dificuldades à equipe.

## 🛠️ Tecnologias

| Camada | Tecnologias |
|---|---|
| Backend | Node.js 22, Express 5 |
| Banco de dados | PostgreSQL (Supabase), driver `pg` |
| Autenticação | Supabase Auth; conta demo local para desenvolvimento |
| Frontend | HTML, CSS e JavaScript puros, servidos pelo Express |
| Testes | Test runner nativo do Node (`node --test`) e jsdom |
| Ferramentas | esbuild, nodemon, Git e GitHub |

## 📂 Estrutura do Projeto

```text
backend/
  client/       Fonte do cliente de autenticação do navegador
  database/     Schema, migrações e scripts SQL de apoio
  src/          API Express: config, rotas, middlewares, controllers, services
  test/         Testes de API, interface, permissões, status e modo demo
publico/        Telas (login, início, abertura, atendimentos, usuários, dashboard)
docs/           Guia técnico do projeto
```

Arquitetura, rotas, regras de chamados e permissões estão detalhadas em
[docs/GUIA-PROJETO.md](docs/GUIA-PROJETO.md).

## 🎯 Objetivo

Desenvolver uma aplicação Help Desk funcional, organizada e intuitiva, aplicando na prática os conhecimentos de Análise e Desenvolvimento de Sistemas, trabalho em equipe, versionamento de código e integração de software.

---

**Desenvolvido pela equipe Help Desk — Projeto Integrador.**
