-- Instalacao inicial no Supabase. Nao substitui migracoes de bancos existentes.
BEGIN;
CREATE TABLE public.users (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 nome VARCHAR(150) NOT NULL CHECK (length(trim(nome)) > 0),
 email VARCHAR(254) NOT NULL CHECK (email = lower(trim(email))),
 perfil VARCHAR(20) NOT NULL DEFAULT 'SOLICITANTE'
  CHECK (perfil IN ('SOLICITANTE','ATENDENTE','TECNICO','ADMIN')),
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX users_email_unique ON public.users (lower(email));
-- Senhas sao gerenciadas exclusivamente pelo Supabase Auth.
CREATE TABLE public.tickets (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 titulo VARCHAR(200) NOT NULL CHECK (length(trim(titulo)) > 0),
 descricao TEXT NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 10000),
 laboratorio VARCHAR(150) NOT NULL CHECK (length(trim(laboratorio)) > 0),
 categoria VARCHAR(100),
 prioridade VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('ALTA','MEDIA','BAIXA')),
 status VARCHAR(20) NOT NULL DEFAULT 'ABERTO'
  CHECK (status IN ('ABERTO','EM_ATENDIMENTO','PENDENTE','RESOLVIDO','FECHADO')),
 solicitante_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 tecnico_id INTEGER REFERENCES public.users(id) ON DELETE RESTRICT,
 nivel_sla VARCHAR(2) NOT NULL DEFAULT 'P3' CHECK (nivel_sla IN ('P1','P2','P3','P4')),
 prazo_sla TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
 data_abertura TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.ticket_history (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 chamado_id INTEGER NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
 usuario_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 status_anterior VARCHAR(20) NOT NULL CHECK (status_anterior IN ('ABERTO','EM_ATENDIMENTO','PENDENTE','RESOLVIDO','FECHADO')),
 status_novo VARCHAR(20) NOT NULL CHECK (status_novo IN ('ABERTO','EM_ATENDIMENTO','PENDENTE','RESOLVIDO','FECHADO')),
 observacao TEXT CHECK (length(observacao) <= 2000),
 data_alteracao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX tickets_solicitante_idx ON public.tickets(solicitante_id);
CREATE INDEX tickets_tecnico_idx ON public.tickets(tecnico_id);
CREATE INDEX tickets_fila_idx ON public.tickets(status, data_abertura);
CREATE INDEX history_chamado_data_idx ON public.ticket_history(chamado_id, data_alteracao DESC);
CREATE INDEX history_usuario_idx ON public.ticket_history(usuario_id);
-- Sem politicas publicas: acesso de usuarios passa pelo Express.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.tickets, public.ticket_history FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.users_id_seq, public.tickets_id_seq, public.ticket_history_id_seq FROM anon, authenticated;
COMMIT;
