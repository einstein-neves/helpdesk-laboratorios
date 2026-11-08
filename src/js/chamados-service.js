(function () {
    "use strict";

    const CHAVE_STORAGE = "helpdesk_chamados";
    const CONFIGURACAO = {
        // Alterar para true quando o backend estiver disponível.
        usarApi: false,
        baseApi: "/api"
    };

    // Enquanto autenticação e backend não estão integrados, este usuário simula
    // o técnico que realizou o login. Depois, ele virá do módulo de autenticação.
    const tecnicoAtual = {
        id: 4,
        nome: "Hilccer",
        perfil: "TECNICO"
    };

    const tecnicos = [
        tecnicoAtual,
        { id: 5, nome: "Matheus", perfil: "TECNICO" },
        { id: 6, nome: "Guilherme", perfil: "TECNICO" }
    ];

    const chamadosIniciais = [
        {
            id: 1042,
            titulo: "Computador não inicializa",
            descricao: "A máquina 07 liga, mas não apresenta imagem no monitor. Os cabos já foram verificados.",
            laboratorio: "Laboratório 03",
            categoria: "Hardware",
            prioridade: "ALTA",
            status: "ABERTO",
            solicitanteId: 21,
            solicitanteNome: "Marina Souza",
            tecnicoId: null,
            dataAbertura: "2026-11-05T11:20:00-03:00",
            dataAtualizacao: "2026-11-05T11:20:00-03:00"
        },
        {
            id: 1038,
            titulo: "Projetor sem conexão HDMI",
            descricao: "O projetor reconhece o cabo, porém exibe a mensagem de ausência de sinal em todos os computadores.",
            laboratorio: "Laboratório 05",
            categoria: "Audiovisual",
            prioridade: "MEDIA",
            status: "ABERTO",
            solicitanteId: 18,
            solicitanteNome: "Carlos Lima",
            tecnicoId: null,
            dataAbertura: "2026-11-05T09:10:00-03:00",
            dataAtualizacao: "2026-11-05T09:10:00-03:00"
        },
        {
            id: 1035,
            titulo: "Sem acesso à internet",
            descricao: "Nenhuma estação do laboratório consegue acessar a rede acadêmica ou sites externos.",
            laboratorio: "Laboratório 01",
            categoria: "Rede",
            prioridade: "ALTA",
            status: "EM_ATENDIMENTO",
            solicitanteId: 12,
            solicitanteNome: "Fernanda Alves",
            tecnicoId: 4,
            dataAbertura: "2026-11-04T16:35:00-03:00",
            dataAtualizacao: "2026-11-05T08:15:00-03:00"
        },
        {
            id: 1031,
            titulo: "Instalação do Visual Studio Code",
            descricao: "É necessário instalar o editor e as extensões recomendadas nas máquinas 01 a 20.",
            laboratorio: "Laboratório 04",
            categoria: "Software",
            prioridade: "BAIXA",
            status: "ABERTO",
            solicitanteId: 25,
            solicitanteNome: "João Ribeiro",
            tecnicoId: null,
            dataAbertura: "2026-11-04T10:00:00-03:00",
            dataAtualizacao: "2026-11-04T10:00:00-03:00"
        },
        {
            id: 1027,
            titulo: "Teclados com teclas travadas",
            descricao: "Os teclados das posições 12 e 14 apresentam várias teclas travadas durante a digitação.",
            laboratorio: "Laboratório 02",
            categoria: "Periféricos",
            prioridade: "MEDIA",
            status: "PENDENTE",
            solicitanteId: 29,
            solicitanteNome: "Ana Beatriz",
            tecnicoId: 4,
            dataAbertura: "2026-11-03T14:20:00-03:00",
            dataAtualizacao: "2026-11-04T09:45:00-03:00"
        },
        {
            id: 1022,
            titulo: "Conta bloqueada no domínio",
            descricao: "O docente não consegue entrar nos computadores do laboratório após várias tentativas de senha.",
            laboratorio: "Laboratório 06",
            categoria: "Acesso",
            prioridade: "BAIXA",
            status: "EM_ATENDIMENTO",
            solicitanteId: 30,
            solicitanteNome: "Paulo Mendes",
            tecnicoId: 5,
            dataAbertura: "2026-11-03T08:40:00-03:00",
            dataAtualizacao: "2026-11-03T10:12:00-03:00"
        }
    ];

    function copiar(valor) {
        return JSON.parse(JSON.stringify(valor));
    }

    function carregarChamados() {
        const dadosSalvos = localStorage.getItem(CHAVE_STORAGE);

        if (!dadosSalvos) {
            localStorage.setItem(CHAVE_STORAGE, JSON.stringify(chamadosIniciais));
            return copiar(chamadosIniciais);
        }

        try {
            return JSON.parse(dadosSalvos);
        } catch (erro) {
            localStorage.setItem(CHAVE_STORAGE, JSON.stringify(chamadosIniciais));
            return copiar(chamadosIniciais);
        }
    }

    function salvarChamados(chamados) {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(chamados));
    }

    function incluirNomeTecnico(chamado) {
        const tecnico = tecnicos.find((item) => item.id === chamado.tecnicoId);
        return {
            ...chamado,
            tecnicoNome: tecnico ? tecnico.nome : null
        };
    }

    async function requisicaoApi(caminho, opcoes = {}) {
        const resposta = await fetch(`${CONFIGURACAO.baseApi}${caminho}`, {
            ...opcoes,
            headers: {
                "Content-Type": "application/json",
                ...opcoes.headers
            }
        });
        const corpo = await resposta.json();

        if (!resposta.ok || corpo.success === false) {
            throw new Error(corpo.message || "Não foi possível concluir a operação.");
        }

        return corpo.data;
    }

    async function listarChamadosMock() {
        return carregarChamados().map(incluirNomeTecnico);
    }

    async function buscarChamadoMock(id) {
        const chamado = carregarChamados().find((item) => item.id === Number(id));

        if (!chamado) {
            throw new Error("Chamado não encontrado.");
        }

        return incluirNomeTecnico(chamado);
    }

    async function atribuirChamadoMock(id, tecnicoId) {
        const chamados = carregarChamados();
        const indice = chamados.findIndex((item) => item.id === Number(id));

        if (indice === -1) {
            throw new Error("Chamado não encontrado.");
        }

        if (chamados[indice].tecnicoId !== null || chamados[indice].status !== "ABERTO") {
            throw new Error("Este chamado não está mais disponível para atribuição.");
        }

        const tecnico = tecnicos.find((item) => item.id === Number(tecnicoId));
        if (!tecnico || tecnico.perfil !== "TECNICO") {
            throw new Error("Técnico inválido.");
        }

        chamados[indice] = {
            ...chamados[indice],
            tecnicoId: tecnico.id,
            status: "EM_ATENDIMENTO",
            dataAtualizacao: new Date().toISOString()
        };

        salvarChamados(chamados);
        return incluirNomeTecnico(chamados[indice]);
    }

    async function listarChamados() {
        if (CONFIGURACAO.usarApi) {
            return requisicaoApi("/tickets");
        }
        return listarChamadosMock();
    }

    async function buscarChamado(id) {
        if (CONFIGURACAO.usarApi) {
            return requisicaoApi(`/tickets/${id}`);
        }
        return buscarChamadoMock(id);
    }

    async function atribuirChamado(id, tecnicoId) {
        if (CONFIGURACAO.usarApi) {
            return requisicaoApi(`/tickets/${id}/assign`, {
                method: "PATCH",
                body: JSON.stringify({ tecnicoId })
            });
        }
        return atribuirChamadoMock(id, tecnicoId);
    }

    window.ChamadosService = {
        CONFIGURACAO,
        tecnicoAtual,
        listarChamados,
        buscarChamado,
        atribuirChamado
    };
}());
