(function () {
    const form = document.querySelector('#formLogin');
    const message = document.querySelector('#mensagem');
    const button = document.querySelector('#entrar');
    const toggle = document.querySelector('#alternar');
    let signup = false;
    let initializing = true;
    button.disabled = toggle.disabled = true;
    HelpDeskAuth.ready.then(async client => {
        if (client.mode === 'demo') {
            document.querySelector('#titulo').textContent = 'Acesso do desenvolvedor';
            document.querySelector('#email').value = client.demoEmail;
            document.querySelector('#email').readOnly = true;
            toggle.hidden = true;
            message.textContent = 'Modo demo local. A senha está no terminal que iniciou o servidor.';
        }
        const { data } = await client.auth.getSession();
        if (data.session) {
            await HelpDeskAuth.requireUser();
            location.replace('/index.html');
        }
    }).catch(error => { message.textContent = error.message; }).finally(() => {
        initializing = false;
        button.disabled = toggle.disabled = false;
    });
    toggle.addEventListener('click', () => {
        signup = !signup;
        document.querySelector('#titulo').textContent = signup ? 'Crie sua conta' : 'Entre na sua conta';
        document.querySelector('#campoNome').hidden = !signup;
        document.querySelector('#nome').required = signup;
        document.querySelector('#senha').minLength = signup ? 8 : 1;
        document.querySelector('#senha').autocomplete = signup ? 'new-password' : 'current-password';
        button.textContent = signup ? 'Criar conta' : 'Entrar';
        toggle.textContent = signup ? 'Já tenho uma conta' : 'Criar uma conta';
        message.textContent = '';
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (initializing || button.disabled) return;
        button.disabled = toggle.disabled = true;
        message.textContent = signup ? 'Criando conta…' : 'Entrando…';
        try {
            // O Express responde em JSON e mantém as credenciais fora das rotas de perfil/chamados.
            const email = document.querySelector('#email').value.trim();
            const password = document.querySelector('#senha').value;
            let result;
            if (signup) {
                result = await HelpDeskAuth.authenticate('/usuarios', {
                    nome: document.querySelector('#nome').value.trim(),
                    email,
                    senha: password
                });
            } else result = await HelpDeskAuth.authenticate('/login', { email, senha: password });
            document.querySelector('#senha').value = '';
            if (!result.session) {
                message.textContent = 'Se o cadastro for permitido, você receberá um e-mail. Confirme o endereço e depois entre na sua conta.';
                return;
            }
            const client = await HelpDeskAuth.ready;
            const { error } = await client.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token
            });
            if (error) throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
            await HelpDeskAuth.requireUser();
            location.replace('/index.html');
        } catch (error) { message.textContent = error.message || 'Falha de conexão. Tente novamente.'; }
        finally { button.disabled = toggle.disabled = false; }
    });
})();
