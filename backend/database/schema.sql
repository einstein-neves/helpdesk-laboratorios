-- BANCO DE DADOS: HELP DESK - LABORATORIOS
-- Estrutura das tabelas do projeto

-- 1. TABELA DE USUARIOS
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT users_perfil_check
        CHECK (perfil IN (
            'SOLICITANTE',
            'ATENDENTE',
            'TECNICO',
            'ADMIN'
        ))
);

-- 2. TABELA DE CHAMADOS
CREATE TABLE tickets (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    laboratorio VARCHAR(150) NOT NULL,
    categoria VARCHAR(100),
    prioridade VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    solicitante_id INTEGER NOT NULL,
    tecnico_id INTEGER,
    data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tickets_status_check
        CHECK (status IN (
            'ABERTO',
            'EM_ATENDIMENTO',
            'PENDENTE',
            'RESOLVIDO',
            'FECHADO'
        )),

    CONSTRAINT tickets_solicitante_id_fkey
        FOREIGN KEY (solicitante_id) REFERENCES users(id),

    CONSTRAINT tickets_tecnico_id_fkey
        FOREIGN KEY (tecnico_id) REFERENCES users(id)
);

-- 3. TABELA DE HISTORICO DOS CHAMADOS
CREATE TABLE ticket_history (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chamado_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    status_anterior VARCHAR(20) NOT NULL,
    status_novo VARCHAR(20) NOT NULL,
    observacao TEXT,
    data_alteracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ticket_history_chamado_id_fkey
        FOREIGN KEY (chamado_id) REFERENCES tickets(id),

    CONSTRAINT ticket_history_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES users(id)
);
