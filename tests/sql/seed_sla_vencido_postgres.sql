-- Teste do RF6 "SLA vencido" — PostgreSQL, usando backend/database/schema.sql
-- O enunciado pede: inserir um chamado com data de abertura ANTIGA direto no banco.
--
-- Atenção: a tabela tickets ainda não tem as colunas nivel_sla / prazo_sla.
-- Por isso o prazo é calculado pela prioridade (ALTA = 8 h, MEDIA = 24 h, BAIXA = 72 h).
--
-- Resultado esperado no dashboard:
--   A (ALTA, ABERTO há 10 h)          → "SLA vencido"
--   B (MEDIA, EM_ATENDIMENTO há 30 h)  → "SLA vencido"
--   C (ALTA, RESOLVIDO há 20 h)        → NÃO aparece como vencido (finalizado)
--   D (BAIXA, ABERTO há 1 h)           → no prazo
-- O card "SLA vencido" deve aumentar em 2.

-- Usuário de teste (solicitante/técnico), exigido pelas chaves estrangeiras
INSERT INTO users (nome, email, senha, perfil)
VALUES ('[teste] Usuário SLA', 'teste.sla@helpdesk.local', 'nao-usar-em-producao', 'TECNICO')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tickets (titulo, descricao, laboratorio, categoria, prioridade, status, solicitante_id, tecnico_id, data_abertura, data_atualizacao)
SELECT v.titulo, 'Teste RF6', v.lab, 'Teste', v.prioridade, v.status, u.id,
       CASE WHEN v.status = 'ABERTO' THEN NULL ELSE u.id END,
       NOW() - v.aberto, NOW() - v.atualizado
FROM (VALUES
  ('[teste] SLA vencido A - ALTA aberto',          'Laboratório 01', 'ALTA',  'ABERTO',         INTERVAL '10 hours', INTERVAL '10 hours'),
  ('[teste] SLA vencido B - MEDIA em atendimento', 'Laboratório 02', 'MEDIA', 'EM_ATENDIMENTO', INTERVAL '30 hours', INTERVAL '25 hours'),
  ('[teste] SLA C - ALTA resolvido (nao vence)',   'Laboratório 03', 'ALTA',  'RESOLVIDO',      INTERVAL '20 hours', INTERVAL '18 hours'),
  ('[teste] SLA D - BAIXA no prazo',               'Laboratório 04', 'BAIXA', 'ABERTO',         INTERVAL '1 hour',   INTERVAL '1 hour')
) AS v(titulo, lab, prioridade, status, aberto, atualizado)
CROSS JOIN (SELECT id FROM users WHERE email = 'teste.sla@helpdesk.local') AS u;

-- Conferência direto no banco (deve listar só A e B):
SELECT id, titulo, prioridade, status, data_abertura,
       data_abertura + CASE prioridade WHEN 'ALTA' THEN INTERVAL '8 hours'
                                       WHEN 'MEDIA' THEN INTERVAL '24 hours'
                                       ELSE INTERVAL '72 hours' END AS prazo
FROM tickets
WHERE status NOT IN ('RESOLVIDO', 'FECHADO')
  AND NOW() > data_abertura + CASE prioridade WHEN 'ALTA' THEN INTERVAL '8 hours'
                                              WHEN 'MEDIA' THEN INTERVAL '24 hours'
                                              ELSE INTERVAL '72 hours' END
ORDER BY data_abertura;
