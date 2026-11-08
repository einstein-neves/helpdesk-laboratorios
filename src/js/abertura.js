// Abertura e cadastro de chamados (RF1, RF2 e CA5)
// Usa os mesmos dados do módulo de atendimentos (localStorage "helpdesk_chamados"),
// seguindo os campos de docs/contratos-api.md.
(function () {
    "use strict";

    // Mesma chave usada em chamados-service.js
    const CHAVE_STORAGE = "helpdesk_chamados";

    // RF2: prazo de cada prioridade, em horas
    const PRAZO_HORAS = { P1: 4, P2: 8, P3: 24, P4: 72 };

    // O contrato (e a fila do atendimento) trabalha com ALTA, MEDIA e BAIXA.
    // Então cada nível P1..P4 vira uma dessas prioridades.
    // O nível original fica guardado em "nivelSla".
    const PRIORIDADE_DO_CONTRATO = { P1: "ALTA", P2: "ALTA", P3: "MEDIA", P4: "BAIXA" };

    const formulario = document.querySelector("#formChamado");
    const mensagem = document.querySelector("#mensagem");
    const listaUltimos = document.querySelector("#ultimosChamados");

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = tipo; // "erro" ou "ok"
    }

    function formatarData(iso) {
        return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    }

    function lerChamados() {
        try {
            return JSON.parse(localStorage.getItem(CHAVE_STORAGE)) || [];
        } catch (erro) {
            return [];
        }
    }

    // RF1 + RF2: monta o chamado já com o prazo calculado
    function montarChamado(dados) {
        const agora = new Date();
        const prazo = new Date(agora.getTime() + PRAZO_HORAS[dados.prioridade] * 60 * 60 * 1000);

        return {
            titulo: dados.titulo,
            descricao: dados.descricao,
            laboratorio: dados.laboratorio,
            categoria: dados.categoria,
            prioridade: PRIORIDADE_DO_CONTRATO[dados.prioridade],
            nivelSla: dados.prioridade,
            status: "ABERTO",
            solicitanteId: null, // virá do login (módulo do Arthur)
            solicitanteNome: dados.solicitante,
            tecnicoId: null,
            dataAbertura: agora.toISOString(),
            dataAtualizacao: agora.toISOString(),
            prazoSla: prazo.toISOString()
        };
    }

    async function salvarChamado(chamado) {
        // Com o backend pronto: POST /api/tickets (ver contratos-api.md)
        if (window.ChamadosService && window.ChamadosService.CONFIGURACAO.usarApi) {
            const config = window.ChamadosService.CONFIGURACAO;
            const resposta = await fetch(config.baseApi + "/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(chamado)
            });
            const corpo = await resposta.json();
            if (!resposta.ok || corpo.success === false) {
                throw new Error(corpo.message || "Não foi possível abrir o chamado.");
            }
            return corpo.data;
        }

        // Sem backend: salva no localStorage junto com os outros chamados
        const chamados = lerChamados();
        const maiorId = chamados.reduce(function (maior, c) { return Math.max(maior, c.id); }, 1000);
        chamado.id = maiorId + 1;
        chamados.push(chamado);
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(chamados));
        return chamado;
    }

    function validar(dados) {
        if (!dados.solicitante || !dados.titulo || !dados.descricao || !dados.laboratorio || !dados.categoria) {
            return "Preencha todos os campos.";
        }
        // CA5: prioridade fora de P1 a P4 é recusada
        if (!PRAZO_HORAS[dados.prioridade]) {
            return "Prioridade inválida. Use de P1 a P4.";
        }
        return null;
    }

    function desenharUltimos() {
        const ultimos = lerChamados()
            .slice()
            .sort(function (a, b) { return new Date(b.dataAbertura) - new Date(a.dataAbertura); })
            .slice(0, 5);

        if (ultimos.length === 0) {
            listaUltimos.innerHTML = '<p class="vazio">Nenhum chamado ainda.</p>';
            return;
        }

        listaUltimos.innerHTML = "";
        ultimos.forEach(function (c) {
            const item = document.createElement("div");
            item.className = "item-chamado";

            const titulo = document.createElement("strong");
            titulo.textContent = "#" + c.id + " · " + c.titulo; // textContent evita HTML digitado

            const info = document.createElement("small");
            const nivel = c.nivelSla ? c.nivelSla + " · " : "";
            const prazo = c.prazoSla ? " · prazo até " + formatarData(c.prazoSla) : "";
            info.textContent = nivel + c.laboratorio + prazo;

            item.appendChild(titulo);
            item.appendChild(info);
            listaUltimos.appendChild(item);
        });
    }

    async function enviar(evento) {
        evento.preventDefault();

        const dados = {
            solicitante: document.querySelector("#solicitante").value.trim(),
            titulo: document.querySelector("#titulo").value.trim(),
            descricao: document.querySelector("#descricao").value.trim(),
            laboratorio: document.querySelector("#laboratorio").value,
            categoria: document.querySelector("#categoria").value,
            prioridade: document.querySelector("#prioridade").value
        };

        const erro = validar(dados);
        if (erro) {
            mostrarMensagem(erro, "erro");
            return;
        }

        const botao = formulario.querySelector("button[type=submit]");
        botao.disabled = true;

        try {
            const criado = await salvarChamado(montarChamado(dados));
            mostrarMensagem(
                "Chamado #" + criado.id + " aberto! Prazo de atendimento: " + formatarData(criado.prazoSla),
                "ok"
            );
            formulario.reset();
            desenharUltimos();
        } catch (e) {
            mostrarMensagem(e.message, "erro");
        } finally {
            botao.disabled = false;
        }
    }

    async function iniciar() {
        // Garante que os chamados de exemplo do módulo de atendimentos já existam
        // antes de salvar o primeiro, para não sobrescrever a lista deles.
        if (window.ChamadosService) {
            try { await window.ChamadosService.listarChamados(); } catch (e) { /* segue sem os exemplos */ }
        }
        formulario.addEventListener("submit", enviar);
        desenharUltimos();
    }

    iniciar();
}());