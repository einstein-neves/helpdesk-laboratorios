import { createClient } from '@supabase/supabase-js';

let profile;
const ready = (async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error('Não foi possível carregar a autenticação.');
    const client = createClient(body.data.url, body.data.publishableKey, {
        auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            profile = null;
            if (!location.pathname.endsWith('/login.html')) location.replace('/login.html');
        }
    });
    return client;
})();
// Evita rejeição não tratada antes de uma página aguardar a inicialização.
ready.catch(() => {});

async function request(path, options = {}) {
    const client = await ready;
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
        location.replace('/login.html');
        throw new Error('Entre na sua conta para continuar.');
    }
    const response = await fetch('/api' + path, {
        ...options,
        headers: { ...options.headers, 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
        cache: 'no-store'
    });
    const body = await response.json();
    if (!response.ok) {
        if (response.status === 401) {
            await client.auth.signOut({ scope: 'local' });
            location.replace('/login.html');
        }
        throw new Error(body.message || 'Não foi possível concluir a operação.');
    }
    return body.data;
}

async function requireUser() {
    if (profile) return profile;
    const client = await ready;
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
        location.replace('/login.html');
        throw new Error('Entre na sua conta para continuar.');
    }
    const name = String(data.session.user.user_metadata?.nome || data.session.user.email.split('@')[0]).trim().slice(0, 150) || 'Usuário';
    profile = await request('/users/me', { method: 'POST', body: JSON.stringify({ nome: name }) });
    return profile;
}

function navigation(user) {
    const nav = document.createElement('nav');
    nav.className = 'session-nav';
    nav.setAttribute('aria-label', 'Navegação da conta');
    const label = document.createElement('span');
    label.textContent = user.nome + ' · ' + user.perfil;
    nav.append(label);
    for (const [href, text] of [['/index.html', 'Início'], ['/abertura.html', 'Abrir chamado'], ['/atendimentos.html', 'Chamados'], ...(user.perfil === 'ADMIN' ? [['/usuarios.html', 'Usuários']] : [])]) {
        const link = document.createElement('a'); link.href = href; link.textContent = text; nav.append(link);
    }
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Sair';
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            const { error } = await (await ready).auth.signOut({ scope: 'local' });
            if (error) throw error;
            location.replace('/login.html');
        } catch { button.disabled = false; button.textContent = 'Falha ao sair. Tentar novamente'; }
    });
    nav.append(button);
    document.querySelector('header').after(nav);
}
window.HelpDeskAuth = { ready, request, requireUser, navigation };
