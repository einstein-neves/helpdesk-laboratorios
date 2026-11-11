(function () {
    "use strict";

    const pesosPrioridade = {
        ALTA: 3,
        MEDIA: 2,
        BAIXA: 1
    };

    const estado = {
        chamados: [],
        fila: "disponiveis",
        chamadoSelecionadoId: null
    };

    const elementos = {
        nomeTecnico: document.querySelector("#nomeTecnico"),
        avatarTecnico: document.querySelector("#avatarTecnico"),
        totalDisponiveis: document.querySelector("#totalDisponiveis"),
        totalEmAtendimento: document.querySelector("#totalEmAtendimento"),
        totalAltaPrioridade: document.querySelector("#totalAltaPrioridade"),
        botaoAtualizar: document.querySelector("#botaoAtualizar"),
        abas: document.querySelectorAll(".aba"),
        busca: document.querySelector("#busca"),
        filtroPrioridade: document.querySelector("#filtroPrioridade"),
        ordenacao: document.querySelector("#ordenacao"),
        tituloFila: document.querySelector("#tituloFila"),
        descricaoFila: document.querySelector("#descricaoFila"),
        quantidadeResultados: document.querySelector("#quantidadeResultados"),
        listaChamados: document.querySelector("#listaChamados"),
        estadoVazio: document.querySelector("#estadoVazio"),
        estadoCarregando: document.querySelector("#estadoCarregando"),
        modal: document.querySelector("#modalDetalhes"),
        fecharModal: document.querySelector("#fecharModal"),
        detalheTitulo: document.querySelector("#detalheTitulo"),
        detalheId: document.querySelector("#detalheId"),
        detalheStatus: document.querySelector("#detalheStatus"),
        detalhePrioridade: document.querySelector("#detalhePrioridade"),
        detalheDescricao: document.querySelector("#detalheDescricao"),
        detalheLaboratorio: document.querySelector("#detalheLaboratorio"),
        detalheCategoria: document.querySelector("#detalheCategoria"),
        detalheSolicitante: document.querySelector("#detalheSolicitante"),
        detalheData: document.querySelector("#detalheData"),
        detalheTecnico: document.querySelector("#detalheTecnico"),
        mensagemAtribuicao: document.querySelector("#mensagemAtribuicao"),
        botaoAssumir: document.querySelector("#botaoAssumir"),
        toast: document.querySelector("#toast")
    };

    function escaparHtml(texto) {
        const elemento = document.createElement("div");
        elemento.textContent = texto == null ? "" : String(texto);
        return elemento.innerHTML;
    }

    function formatarTextoEnum(valor) {
        if (!valor) return "—";
        return valor
            .toLowerCase()
            .replaceAll("_", " ")
            .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
    }

    function formatarData(dataIso) {
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(new Date(dataIso));
    }

    function obterIniciais(nome) {
        return nome
            .split(" ")
            .slice(0, 2)
            .map((parte) => parte[0])
            .join("")
            .toUpperCase();
    }

    function chamadosDaFila() {
        const tecnicoId = window.ChamadosService.tecnicoAtual.id;
        if (estado.fila === "todos") return estado.chamados;

        if (estado.fila === "disponiveis") {
            return estado.chamados.filter((chamado) =>
                chamado.status === "ABERTO" && chamado.tecnicoId === null
            );
        }

        return estado.chamados.filter((chamado) =>
            chamado.tecnicoId === tecnicoId &&
            !["RESOLVIDO", "FECHADO"].includes(chamado.status)
        );
    }

    function aplicarFiltros(chamados) {
        const termo = elementos.busca.value.trim().toLocaleLowerCase("pt-BR");
        const prioridade = elementos.filtroPrioridade.value;

        return chamados.filter((chamado) => {
            const correspondePrioridade = prioridade === "TODAS" || chamado.prioridade === prioridade;
            const conteudoBusca = [chamado.titulo, chamado.laboratorio, chamado.categoria]
                .join(" ")
                .toLocaleLowerCase("pt-BR");
            const correspondeBusca = !termo || conteudoBusca.includes(termo);

            return correspondePrioridade && correspondeBusca;
        });
    }

    function ordenarChamados(chamados) {
        const ordenacao = elementos.ordenacao.value;
        const copia = [...chamados];

        if (ordenacao === "MAIS_ANTIGOS") {
            return copia.sort((a, b) => new Date(a.dataAbertura) - new Date(b.dataAbertura));
        }

        if (ordenacao === "MAIS_RECENTES") {
            return copia.sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
        }

        return copia.sort((a, b) => {
            const diferencaPrioridade = pesosPrioridade[b.prioridade] - pesosPrioridade[a.prioridade];
            return diferencaPrioridade || new Date(a.dataAbertura) - new Date(b.dataAbertura);
        });
    }

    function criarLinha(chamado) {
        const responsavel = chamado.tecnicoNome || "Não atribuído";
        return `
            <tr>
                <td data-label="Chamado">
                    <strong>#${chamado.id} · ${escaparHtml(chamado.titulo)}</strong>
                    <small>${escaparHtml(chamado.categoria)}</small>
                </td>
                <td data-label="Laboratório">${escaparHtml(chamado.laboratorio)}</td>
                <td data-label="Prioridade">
                    <span class="prioridade prioridade-${chamado.prioridade.toLowerCase()}">
                        ${formatarTextoEnum(chamado.prioridade)}
                    </span>
                </td>
                <td data-label="Aberto em">${formatarData(chamado.dataAbertura)}</td>
                <td data-label="Responsável">
                    <span class="responsavel ${chamado.tecnicoId === null ? "sem-responsavel" : ""}">
                        ${escaparHtml(responsavel)}
                    </span>
                </td>
                <td class="coluna-acao">
                    <button class="botao-link" type="button" data-detalhes-id="${chamado.id}">
                        Ver detalhes
                    </button>
                </td>
            </tr>
        `;
    }

    function renderizarIndicadores() {
        const tecnicoId = window.ChamadosService.tecnicoAtual.id;
        const disponiveis = estado.chamados.filter((chamado) =>
            chamado.status === "ABERTO" && chamado.tecnicoId === null
        );
        const meus = estado.chamados.filter((chamado) =>
            chamado.tecnicoId === tecnicoId && !["RESOLVIDO", "FECHADO"].includes(chamado.status)
        );

        elementos.totalDisponiveis.textContent = disponiveis.length;
        elementos.totalEmAtendimento.textContent = meus.length;
        elementos.totalAltaPrioridade.textContent = disponiveis.filter((chamado) =>
            chamado.prioridade === "ALTA"
        ).length;
    }

    function renderizarLista() {
        const chamados = ordenarChamados(aplicarFiltros(chamadosDaFila()));
        const quantidade = chamados.length;

        elementos.listaChamados.innerHTML = chamados.map(criarLinha).join("");
        elementos.quantidadeResultados.textContent = `${quantidade} ${quantidade === 1 ? "chamado" : "chamados"}`;
        elementos.estadoVazio.hidden = quantidade > 0;

        elementos.listaChamados.querySelectorAll("[data-detalhes-id]").forEach((botao) => {
            botao.addEventListener("click", () => abrirDetalhes(Number(botao.dataset.detalhesId)));
        });
    }

    function atualizarCabecalhoFila() {
        if (estado.fila === 'todos') {
            elementos.tituloFila.textContent = 'Chamados permitidos para sua conta';
            elementos.descricaoFila.textContent = 'Acompanhe o status e consulte o histórico dos chamados.';
            return;
        }
        const disponiveis = estado.fila === "disponiveis";
        elementos.tituloFila.textContent = disponiveis
            ? "Fila de chamados disponíveis"
            : "Chamados sob sua responsabilidade";
        elementos.descricaoFila.textContent = disponiveis
            ? "Chamados ainda sem um técnico responsável."
            : "Acompanhe os chamados que você assumiu e que ainda estão em andamento.";
    }

    async function carregarChamados(mostrarMensagem = false) {
        elementos.estadoCarregando.hidden = false;
        elementos.estadoVazio.hidden = true;
        elementos.listaChamados.innerHTML = "";

        try {
            estado.chamados = await window.ChamadosService.listarChamados();
            renderizarIndicadores();
            renderizarLista();
            if (mostrarMensagem) mostrarToast("Fila atualizada com sucesso.", "sucesso");
        } catch (erro) {
            mostrarToast(erro.message || "Não foi possível carregar os chamados.", "erro");
        } finally {
            elementos.estadoCarregando.hidden = true;
        }
    }

    async function abrirDetalhes(id) {
        try {
            const chamado = await window.ChamadosService.buscarChamado(id);
            estado.chamadoSelecionadoId = chamado.id;

            elementos.detalheTitulo.textContent = chamado.titulo;
            elementos.detalheId.textContent = `Chamado #${chamado.id}`;
            elementos.detalheStatus.textContent = formatarTextoEnum(chamado.status);
            elementos.detalheStatus.className = `status status-${chamado.status.toLowerCase()}`;
            elementos.detalhePrioridade.textContent = formatarTextoEnum(chamado.prioridade);
            elementos.detalhePrioridade.className = `prioridade prioridade-${chamado.prioridade.toLowerCase()}`;
            elementos.detalheDescricao.textContent = chamado.descricao;
            elementos.detalheLaboratorio.textContent = chamado.laboratorio;
            elementos.detalheCategoria.textContent = chamado.categoria;
            elementos.detalheSolicitante.textContent = chamado.solicitanteNome || `Usuário #${chamado.solicitanteId}`;
            elementos.detalheData.textContent = formatarData(chamado.dataAbertura);
            elementos.detalheTecnico.textContent = chamado.tecnicoNome || "Aguardando atribuição";

            const disponivel = chamado.status === "ABERTO" && chamado.tecnicoId === null;
            elementos.botaoAssumir.hidden = !disponivel || window.ChamadosService.tecnicoAtual.perfil !== "TECNICO";
            elementos.mensagemAtribuicao.textContent = disponivel
                ? "Ao assumir, o chamado entrará na sua fila de atendimento."
                : `Responsável atual: ${chamado.tecnicoNome || "não definido"}.`;

            await prepararControles(chamado);
            elementos.modal.showModal();
        } catch (erro) {
            mostrarToast(erro.message || "Não foi possível abrir os detalhes.", "erro");
        }
    }

    async function assumirChamado() {
        if (!estado.chamadoSelecionadoId) return;

        elementos.botaoAssumir.disabled = true;
        elementos.botaoAssumir.textContent = "Atribuindo...";

        try {
            await window.ChamadosService.atribuirChamado(
                estado.chamadoSelecionadoId,
                window.ChamadosService.tecnicoAtual.id
            );
            elementos.modal.close();
            await carregarChamados();
            mostrarToast("Chamado atribuído a você com sucesso.", "sucesso");
        } catch (erro) {
            mostrarToast(erro.message || "Não foi possível atribuir o chamado.", "erro");
        } finally {
            elementos.botaoAssumir.disabled = false;
            elementos.botaoAssumir.textContent = "Assumir chamado";
        }
    }

    let temporizadorToast;
    function mostrarToast(mensagem, tipo) {
        clearTimeout(temporizadorToast);
        elementos.toast.textContent = mensagem;
        elementos.toast.className = `toast visivel toast-${tipo}`;
        temporizadorToast = setTimeout(() => {
            elementos.toast.classList.remove("visivel");
        }, 3500);
    }

    function configurarEventos() {
        elementos.abas.forEach((aba) => {
            aba.addEventListener("click", () => {
                estado.fila = aba.dataset.fila;
                elementos.abas.forEach((item) => {
                    const ativa = item === aba;
                    item.classList.toggle("ativa", ativa);
                    item.setAttribute("aria-selected", String(ativa));
                });
                atualizarCabecalhoFila();
                renderizarLista();
            });
        });

        [elementos.busca, elementos.filtroPrioridade, elementos.ordenacao].forEach((controle) => {
            controle.addEventListener("input", renderizarLista);
        });

        elementos.botaoAtualizar.addEventListener("click", () => carregarChamados(true));
        elementos.fecharModal.addEventListener("click", () => elementos.modal.close());
        elementos.botaoAssumir.addEventListener("click", assumirChamado);
        elementos.modal.addEventListener("click", (evento) => {
            if (evento.target === elementos.modal) elementos.modal.close();
        });
    }

    async function iniciar() {
        const tecnico = await window.ChamadosService.iniciar();
        HelpDeskAuth.navigation(tecnico);
        if (tecnico.perfil === 'SOLICITANTE') {
            estado.fila = 'todos';
            elementos.abas.forEach(aba => {
                aba.hidden = aba.dataset.fila !== 'todos';
                aba.classList.toggle('ativa', aba.dataset.fila === 'todos');
                aba.setAttribute('aria-selected', String(aba.dataset.fila === 'todos'));
            });
        }
        atualizarCabecalhoFila();
        elementos.nomeTecnico.textContent = tecnico.nome;
        elementos.avatarTecnico.textContent = obterIniciais(tecnico.nome);
        configurarEventos();
        carregarChamados();
    }


    const transicoes = { ABERTO:['EM_ATENDIMENTO'], EM_ATENDIMENTO:['PENDENTE','RESOLVIDO'], PENDENTE:['EM_ATENDIMENTO','RESOLVIDO'], RESOLVIDO:['FECHADO'], FECHADO:[] };
    async function prepararControles(chamado) {
        const user = ChamadosService.tecnicoAtual;
        const statuses = transicoes[chamado.status] || [];
        document.querySelector('#controlesAtendimento').hidden = !(statuses.length && (user.perfil === 'ADMIN' || (user.perfil === 'TECNICO' && chamado.tecnicoId === user.id)));
        const select = document.querySelector('#novoStatus'); select.replaceChildren();
        for (const status of statuses) {
            const option=document.createElement('option');option.value=status;option.textContent=formatarTextoEnum(status);select.append(option);
        }
        document.querySelector('#observacaoStatus').value='';
        const atribuir = ['ATENDENTE','ADMIN'].includes(user.perfil) && chamado.status === 'ABERTO' && chamado.tecnicoId === null;
        document.querySelector('#controlesAtribuicao').hidden = !atribuir;
        if (atribuir) {
            const target=document.querySelector('#tecnicoDestino'); target.replaceChildren();
            const tecnicos=await ChamadosService.listarTecnicos();
            for(const tecnico of tecnicos){const option=document.createElement('option');option.value=tecnico.id;option.textContent=tecnico.nome;target.append(option);}
            document.querySelector('#atribuirTecnico').disabled=!tecnicos.length;
        }
        const history=document.querySelector('#historicoChamado');history.replaceChildren();
        try {
            const entries=await ChamadosService.consultarHistorico(chamado.id);
            if(!entries.length) history.textContent='Nenhuma alteração registrada.';
            for(const entry of entries){const item=document.createElement('p');item.textContent=formatarData(entry.dataAlteracao)+' · '+formatarTextoEnum(entry.statusAnterior)+' → '+formatarTextoEnum(entry.statusNovo)+(entry.observacao?' · '+entry.observacao:'');history.append(item);}
        } catch(error){history.textContent=error.message;}
    }
    document.querySelector('#salvarStatus').addEventListener('click', async event => {
        const button=event.currentTarget;button.disabled=true;
        try {
            await ChamadosService.atualizarStatus(estado.chamadoSelecionadoId,document.querySelector('#novoStatus').value,document.querySelector('#observacaoStatus').value.trim());
            await carregarChamados();await abrirDetalhes(estado.chamadoSelecionadoId);mostrarToast('Status atualizado.','sucesso');
        } catch(error){mostrarToast(error.message,'erro');}finally{button.disabled=false;}
    });
    document.querySelector('#atribuirTecnico').addEventListener('click', async event => {
        const button=event.currentTarget;button.disabled=true;
        try {
            await ChamadosService.atribuirChamado(estado.chamadoSelecionadoId,Number(document.querySelector('#tecnicoDestino').value));
            await carregarChamados();await abrirDetalhes(estado.chamadoSelecionadoId);mostrarToast('Técnico atribuído.','sucesso');
        } catch(error){mostrarToast(error.message,'erro');}finally{button.disabled=false;}
    });

    iniciar().catch(error => {
        elementos.estadoCarregando.hidden = true;
        mostrarToast(error.message, 'erro');
    });
}());
