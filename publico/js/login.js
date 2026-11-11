(function () {
    const form = document.querySelector('#formLogin');
    const message = document.querySelector('#mensagem');
    const button = document.querySelector('#entrar');
    const toggle = document.querySelector('#alternar');
    let signup = false;
    let initializing = true;
    button.disabled = toggle.disabled = true;
    HelpDeskAuth.ready.then(async client => {
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
            const client = await HelpDeskAuth.ready;
            const email = document.querySelector('#email').value.trim();
            const password = document.querySelector('#senha').value;
            let result;
            if (signup) {
                result = await client.auth.signUp({ email, password, options: {
                    data: { nome: document.querySelector('#nome').value.trim() },
                    emailRedirectTo: location.origin + '/login.html'
                }});
            } else result = await client.auth.signInWithPassword({ email, password });
            if (result.error) {
                message.textContent = signup
                    ? 'Não foi possível criar a conta. Verifique os dados e tente novamente mais tarde.'
                    : 'Não foi possível entrar. Confira e-mail, senha e confirmação do e-mail.';
                return;
            }
            document.querySelector('#senha').value = '';
            if (!result.data.session) {
                message.textContent = 'Se o cadastro for permitido, você receberá um e-mail. Confirme o endereço e depois entre na sua conta.';
                return;
            }
            await HelpDeskAuth.requireUser();
            location.replace('/index.html');
        } catch (error) { message.textContent = error.message || 'Falha de conexão. Tente novamente.'; }
        finally { button.disabled = toggle.disabled = false; }
    });
})();
