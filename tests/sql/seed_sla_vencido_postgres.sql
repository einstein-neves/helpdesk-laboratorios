-- Teste do RF6 "SLA vencido" — PostgreSQL
-- Insere chamados com aberto_em ANTIGO direto no banco (pedido no enunciado).
-- Resultado esperado na interface:
--   #A (P1, aberto há 6 h, prazo 4 h)            → linha vermelha "SLA vencido"
--   #B (P2, em_atendimento há 10 h, prazo 8 h)   → linha vermelha "SLA vencido"
--   #C (P3, resolvido, prazo já passou)          → NÃO aparece como vencido
--   #D (P4, aberto há 1 h, prazo 72 h)           → no prazo
-- Card "SLA vencido" do dashboard deve mostrar +2.

INSERT INTO chamados (titulo, descricao, laboratorio, prioridade, status, solucao, aberto_em, prazo_sla, resolvido_em) VALUES
('[teste] SLA vencido A - P1 aberto',         'Teste RF6', 'Lab 01', 'P1', 'aberto',         NULL,            NOW() - INTERVAL '6 hours',  NOW() - INTERVAL '6 hours'  + INTERVAL '4 hours',  NULL),
('[teste] SLA vencido B - P2 em atendimento', 'Teste RF6', 'Lab 02', 'P2', 'em_atendimento', NULL,            NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours' + INTERVAL '8 hours',  NULL),
('[teste] SLA C - P3 resolvido (nao vence)',  'Teste RF6', 'Lab 03', 'P3', 'resolvido',      'Teste: resolvido', NOW() - INTERVAL '30 hours', NOW() - INTERVAL '30 hours' + INTERVAL '24 hours', NOW() - INTERVAL '29 hours'),
('[teste] SLA D - P4 no prazo',               'Teste RF6', 'Lab 04', 'P4', 'aberto',         NULL,            NOW() - INTERVAL '1 hour',   NOW() - INTERVAL '1 hour'   + INTERVAL '72 hours', NULL);

-- Conferência direto no banco (deve listar só A e B):
SELECT id, titulo, prioridade, status, prazo_sla
FROM chamados
WHERE NOW() > prazo_sla AND status NOT IN ('resolvido', 'fechado')
ORDER BY prioridade, aberto_em;
