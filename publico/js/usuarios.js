(async function () {
    const message = document.querySelector('#mensagem');
    const previous = document.querySelector('#anterior');
    const next = document.querySelector('#proximo');
    let offset = 0;
    let user;

    async function load() {
        previous.disabled = next.disabled = true;
        const users = await HelpDeskAuth.request('/users?offset=' + offset);
        const list = document.querySelector('#listaUsuarios');
        list.replaceChildren();

        for (const item of users) {
            const row = document.createElement('tr');
            for (const value of [item.nome, item.email]) {
                const td = document.createElement('td');
                td.textContent = value;
                row.append(td);
            }

            const role = document.createElement('select');
            role.setAttribute('aria-label', 'Perfil de ' + item.nome);
            for (const name of ['SOLICITANTE', 'ATENDENTE', 'TECNICO', 'ADMIN']) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                option.selected = item.perfil === name;
                role.append(option);
            }
            const active = document.createElement('input');
            active.type = 'checkbox';
            active.checked = item.ativo;
            active.setAttribute('aria-label', 'Conta ativa de ' + item.nome);

            const save = document.createElement('button');
            save.type = 'button';
            save.textContent = 'Salvar';
            if (item.id === user.id) role.disabled = active.disabled = save.disabled = true;

            save.addEventListener('click', async () => {
                save.disabled = true;
                try {
                    await HelpDeskAuth.request('/users/' + item.id, {
                        method: 'PATCH',
                        body: JSON.stringify({ perfil: role.value, ativo: active.checked })
                    });
                    message.textContent = 'Permissões de ' + item.nome + ' atualizadas.';
                } catch (error) {
                    message.textContent = error.message;
                } finally {
                    save.disabled = false;
                }
            });

            for (const control of [role, active, save]) {
                const td = document.createElement('td');
                td.append(control);
                row.append(td);
            }
            list.append(row);
        }

        document.querySelector('#tabelaUsuarios').hidden = false;
        previous.disabled = offset === 0; next.disabled = users.length < 50;
        message.textContent = users.length + ' usuários nesta página.';
    }
    try {
        user = await HelpDeskAuth.requireUser(); HelpDeskAuth.navigation(user);
        if (user.perfil !== 'ADMIN') {
            message.textContent = 'Acesso restrito a administradores.';
            return;
        }
        previous.addEventListener('click', () => {
            offset = Math.max(0, offset - 50);
            load().catch((error) => { message.textContent = error.message; });
        });
        next.addEventListener('click', () => {
            offset += 50;
            load().catch((error) => { message.textContent = error.message; });
        });
        await load();
    } catch (error) {
        message.textContent = error.message;
    }
})();
