# Guia de colaboração da equipe

Este guia reúne o fluxo recomendado para desenvolver, revisar e integrar
alterações no Help Desk. A branch `main` deve permanecer estável: não trabalhe
nela diretamente; use uma branch própria e abra um Pull Request (PR).

## 1. Antes de começar

1. Abra o terminal na pasta raiz do projeto.
2. Confira se há alterações locais antes de trocar de branch:

   ```bash
   git status
   ```

3. Atualize a `main` e crie uma branch para a tarefa:

   ```bash
   git switch main
   git pull --ff-only origin main
   git switch -c feature/descricao-curta
   ```

   Use `fix/descricao-curta` para correções ou `docs/descricao-curta` para
   alterações apenas na documentação. Exemplos: `feature/abertura-chamados`,
   `fix/filtro-status` e `docs/guia-equipe`.

Se houver alterações locais que impeçam a troca de branch, salve-as em um
commit ou guarde-as com `git stash` antes de continuar.

## 2. Durante o desenvolvimento

- Mantenha cada branch focada em uma tarefa.
- Confira `git status` antes de cada commit e não inclua arquivos que não fazem
  parte da tarefa.
- Escreva mensagens de commit curtas e descritivas. Exemplos:

  ```text
  feat: adiciona filtro por prioridade
  fix: corrige ordenação da fila
  docs: atualiza guia da equipe
  ```

- Não inclua credenciais, arquivos `.env` ou outros segredos nos commits.
- Teste as alterações relevantes antes de solicitar revisão. Na interface,
  valide o fluxo afetado no navegador. No backend, confira os scripts
  disponíveis em `backend/package.json`; ainda não há testes automatizados
  configurados nesse pacote.

## 3. Enviar a branch

Envie a branch ao GitHub. Na primeira publicação, configure o acompanhamento
remoto com `-u`:

```bash
git push -u origin feature/descricao-curta
```

Nos próximos envios, enquanto estiver nessa branch, use:

```bash
git push
```

## 4. Abrir e revisar o Pull Request

1. Abra um PR da sua branch para `main`.
2. Descreva o que mudou, por que mudou e como a alteração foi testada.
3. Relacione telas, rotas ou módulos afetados e inclua imagens quando ajudarem
   a revisar mudanças na interface.
4. Aguarde a revisão e resolva os comentários antes do merge.
5. Integre o PR somente após a aprovação e a conclusão das verificações
   exigidas pelo repositório.

Antes de pedir a revisão, confirme que:

- o PR contém somente as alterações da tarefa;
- os arquivos relevantes foram testados;
- não há conflitos conhecidos com `main`;
- a descrição do PR corresponde ao comportamento implementado.

## 5. Atualizar a branch e resolver conflitos

Se `main` receber alterações enquanto você trabalha, atualize sua branch:

```bash
git fetch origin
git switch feature/descricao-curta
git merge origin/main
```

Se houver conflitos, resolva-os nos arquivos indicados, confira o resultado
com `git status`, teste novamente e conclua o merge antes de enviar a branch.
Não descarte alterações de outras pessoas sem entender o impacto; peça ajuda à
equipe se não tiver certeza.

## 6. Comunicação e responsabilidades

Avise a equipe sobre bloqueios, mudanças de escopo e decisões que afetem outros
módulos. Consulte o [README do projeto](../README.md) para ver a divisão de
responsabilidades e a visão geral do sistema.
