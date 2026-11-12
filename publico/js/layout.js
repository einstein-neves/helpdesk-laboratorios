// Layout compartilhado: monta o menu lateral único de todas as telas autenticadas.
//
// Uso em cada página:
//   <body class="pagina-interna" data-pagina="inicio|abertura|atendimentos|dashboard|usuarios">
//       <script src="js/layout.js"></script>            ← primeiro elemento do body
//       <header class="hd-page-header">…</header>
//       <main class="hd-content">…</main>
//
// Para incluir uma tela no menu, adicione um item em ITENS — nenhuma página
// precisa ser editada. Os dados da conta chegam por definirUsuario(), chamado
// por HelpDeskAuth.navigation(user).
(function () {
    const ITENS = [
        { id: 'inicio', href: 'index.html', rotulo: 'Início', icone: '<path d="M2.5 7.2 8 2.8l5.5 4.4V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V7.2Z"/>' },
        { id: 'abertura', href: 'abertura.html', rotulo: 'Abrir chamado', icone: '<path d="M8 3v10M3 8h10"/>' },
        { id: 'atendimentos', href: 'atendimentos.html', rotulo: 'Atendimentos', icone: '<path d="M2 4h12M2 8h12M2 12h8"/>' },
        { id: 'dashboard', href: 'dashboard.html', rotulo: 'Dashboard', icone: '<rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/>' },
        { id: 'usuarios', href: 'usuarios.html', rotulo: 'Usuários', perfil: 'ADMIN', icone: '<circle cx="8" cy="5.5" r="2.8"/><path d="M2.8 13.6c.6-2.5 2.7-4 5.2-4s4.6 1.5 5.2 4"/>' },
    ];
    const PERFIS = { SOLICITANTE: 'Solicitante', ATENDENTE: 'Atendente', TECNICO: 'Técnico', ADMIN: 'Administrador' };

    let barra;

    function iniciais(nome) {
        const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
        if (!partes.length) return '--';
        return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
    }

    function montar() {
        if (barra) return barra;
        const atual = document.body.dataset.pagina;
        barra = document.createElement('aside');
        barra.className = 'hd-sidebar';
        barra.setAttribute('aria-label', 'Menu principal');
        // Conteúdo estático (sem dados externos); nome e perfil entram via textContent.
        barra.innerHTML = `
            <a class="hd-marca" href="index.html" aria-label="Help Desk dos Laboratórios — início">
                <span class="hd-marca-simbolo" aria-hidden="true">HD</span>
                <span class="hd-marca-texto"><strong>Help Desk</strong><small>dos Laboratórios</small></span>
            </a>
            <nav class="hd-nav" aria-label="Navegação principal">
                <p class="hd-nav-titulo">Menu</p>
                ${ITENS.map((item) => `
                <a href="${item.href}" data-item="${item.id}"${item.perfil ? ` data-perfil="${item.perfil}" hidden` : ''}${item.id === atual ? ' aria-current="page"' : ''}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">${item.icone}</svg><span>${item.rotulo}</span>
                </a>`).join('')}
            </nav>
            <div class="hd-usuario" hidden>
                <span class="hd-avatar" aria-hidden="true">--</span>
                <span class="hd-usuario-texto"><strong></strong><small></small></span>
                <button class="hd-sair" type="button">Sair</button>
            </div>`;
        document.body.prepend(barra);
        return barra;
    }

    // Preenche a conta conectada, libera os itens restritos ao perfil e liga o botão "Sair".
    function definirUsuario(usuario, { sair } = {}) {
        montar();
        barra.querySelectorAll('[data-perfil]').forEach((link) => {
            link.hidden = link.dataset.perfil !== usuario.perfil;
        });
        const bloco = barra.querySelector('.hd-usuario');
        bloco.querySelector('.hd-avatar').textContent = iniciais(usuario.nome);
        bloco.querySelector('strong').textContent = usuario.nome;
        bloco.querySelector('small').textContent = PERFIS[usuario.perfil] || usuario.perfil;
        const botao = bloco.querySelector('.hd-sair');
        botao.hidden = typeof sair !== 'function';
        botao.onclick = async () => {
            botao.disabled = true;
            try {
                await sair();
            } catch {
                botao.disabled = false;
                botao.textContent = 'Tentar sair de novo';
            }
        };
        bloco.hidden = false;
    }

    window.HelpDeskLayout = { montar, definirUsuario };
    if (document.body) montar();
    else document.addEventListener('DOMContentLoaded', montar);
})();
