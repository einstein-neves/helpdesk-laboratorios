import { createClient } from '@supabase/supabase-js';

let profile;
function createDemoClient(email) {
    const storageKey = 'helpdesk-demo-token';
    const listeners = new Set();
    function currentSession() {
        const token = localStorage.getItem(storageKey);
        return token ? {
            access_token: token,
            refresh_token: token,
            user: { id: 'local-demo-user', email, user_metadata: { nome: 'Desenvolvedor' } }
        } : null;
    }
    function notify(event, session) {
        for (const listener of listeners) listener(event, session);
    }
    return {
        mode: 'demo',
        demoEmail: email,
        auth: {
            getSession: async () => ({ data: { session: currentSession() }, error: null }),
            setSession: async tokens => {
                if (!tokens.access_token || !tokens.refresh_token) {
                    return { data: { session: null }, error: new Error('Sessão demo inválida.') };
                }
                localStorage.setItem(storageKey, tokens.access_token);
                const session = currentSession();
                notify('SIGNED_IN', session);
                return { data: { session }, error: null };
            },
            signOut: async () => {
                localStorage.removeItem(storageKey);
                notify('SIGNED_OUT', null);
                return { error: null };
            },
            onAuthStateChange: callback => {
                listeners.add(callback);
                return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
            }
        }
    };
}
async function readJson(response) {
    try { return await response.json(); }
    catch { throw new Error('O servidor retornou uma resposta inválida.'); }
}
const ready = (async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const body = await readJson(response);
    if (!response.ok) throw new Error('Não foi possível carregar a autenticação.');
    const client = body.data.mode === 'demo'
        ? createDemoClient(body.data.demoEmail)
        : createClient(body.data.url, body.data.publishableKey, {
            auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
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
    const body = await readJson(response);
    if (!response.ok) {
        if (response.status === 401) {
            await client.auth.signOut({ scope: 'local' });
            location.replace('/login.html');
        }
        throw new Error(body.message || 'Não foi possível concluir a operação.');
    }
    if (!body || body.success !== true || !('data' in body)) {
        throw new Error('O servidor retornou uma resposta inválida.');
    }
    return body.data;
}

// Envia credenciais apenas às rotas públicas de cadastro e login.
async function authenticate(path, payload) {
    if (path !== '/login' && path !== '/usuarios') throw new Error('Operação de autenticação inválida.');
    const response = await fetch('/api' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body?.message || 'Não foi possível autenticar.');
    if (!body || body.success !== true || !('data' in body)) {
        throw new Error('O servidor retornou uma resposta inválida.');
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

async function signOut() {
    const { error } = await (await ready).auth.signOut({ scope: 'local' });
    if (error) throw error;
    location.replace('/login.html');
}

// O menu é único e fica em publico/js/layout.js; aqui só entregamos a conta e a ação de sair.
function navigation(user) {
    window.HelpDeskLayout?.definirUsuario(user, { sair: signOut });
}
window.HelpDeskAuth = { ready, request, authenticate, requireUser, navigation };
