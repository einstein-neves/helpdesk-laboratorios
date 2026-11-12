(function () {
    const form = document.querySelector('#formChamado');
    const message = document.querySelector('#mensagem');
    const submit = form.querySelector('[type=submit]');
    let user;

    submit.disabled = true;

    const prioridades = { P1: 'ALTA', P2: 'ALTA', P3: 'MEDIA', P4: 'BAIXA' };

    async function renderRecent() {
        const list = document.querySelector('#ultimosChamados');
        const tickets = (await ChamadosService.listarChamados())
            .filter((ticket) => ticket.solicitanteId === user.id)
            .slice(0, 5);

        list.replaceChildren();
        if (!tickets.length) {
            list.textContent = 'Você ainda não abriu chamados.';
            return;
        }

        for (const ticket of tickets) {
            const item = document.createElement('p');
            item.textContent = '#' + ticket.id + ' · ' + ticket.titulo + ' · ' + ticket.status;
            list.append(item);
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!user || submit.disabled) return;

        // Envia apenas os campos do formulário; autoria e prazo são apurados no servidor.
        const nivelSla = document.querySelector('#prioridade').value;
        const body = {
            titulo: document.querySelector('#titulo').value.trim(),
            descricao: document.querySelector('#descricao').value.trim(),
            laboratorio: document.querySelector('#laboratorio').value,
            categoria: document.querySelector('#categoria').value,
            prioridade: prioridades[nivelSla],
            nivelSla,
        };

        if (!body.titulo || !body.descricao || !body.laboratorio || !body.categoria || !body.prioridade) {
            message.textContent = 'Preencha todos os campos.';
            return;
        }

        submit.disabled = true;
        try {
            const ticket = await ChamadosService.criarChamado(body);
            message.textContent = 'Chamado #' + ticket.id + ' aberto! Prazo: '
                + new Date(ticket.prazoSla).toLocaleString('pt-BR');
            message.className = 'ok';
            form.reset();
            document.querySelector('#solicitante').value = user.nome;

            try {
                await renderRecent();
            } catch {
                message.textContent += ' Atualize a página para recarregar a lista.';
            }
        } catch (error) {
            message.textContent = error.message;
            message.className = 'erro';
        } finally {
            submit.disabled = false;
        }
    });

    (async () => {
        try {
            user = await ChamadosService.iniciar();
            HelpDeskAuth.navigation(user);
            const input = document.querySelector('#solicitante');
            input.value = user.nome;
            input.readOnly = true;
            await renderRecent();
            submit.disabled = false;
        } catch (error) {
            message.textContent = error.message;
        }
    })();
})();
