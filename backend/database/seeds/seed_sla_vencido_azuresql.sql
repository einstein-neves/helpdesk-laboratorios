-- Teste do RF6 "SLA vencido" — Azure SQL (T-SQL)
-- Mesmo cenário do arquivo PostgreSQL. Datas em UTC (SYSUTCDATETIME).
-- Esperado: A e B aparecem como "SLA vencido"; C (resolvido) e D (no prazo) não.

INSERT INTO chamados (titulo, descricao, laboratorio, prioridade, status, solucao, aberto_em, prazo_sla, resolvido_em) VALUES
('[teste] SLA vencido A - P1 aberto',         'Teste RF6', 'Lab 01', 'P1', 'aberto',         NULL,               DATEADD(HOUR, -6,  SYSUTCDATETIME()), DATEADD(HOUR, -2,  SYSUTCDATETIME()), NULL),
('[teste] SLA vencido B - P2 em atendimento', 'Teste RF6', 'Lab 02', 'P2', 'em_atendimento', NULL,               DATEADD(HOUR, -10, SYSUTCDATETIME()), DATEADD(HOUR, -2,  SYSUTCDATETIME()), NULL),
('[teste] SLA C - P3 resolvido (nao vence)',  'Teste RF6', 'Lab 03', 'P3', 'resolvido',      'Teste: resolvido', DATEADD(HOUR, -30, SYSUTCDATETIME()), DATEADD(HOUR, -6,  SYSUTCDATETIME()), DATEADD(HOUR, -29, SYSUTCDATETIME())),
('[teste] SLA D - P4 no prazo',               'Teste RF6', 'Lab 04', 'P4', 'aberto',         NULL,               DATEADD(HOUR, -1,  SYSUTCDATETIME()), DATEADD(HOUR, 71,  SYSUTCDATETIME()), NULL);

SELECT id, titulo, prioridade, status, prazo_sla
FROM chamados
WHERE SYSUTCDATETIME() > prazo_sla AND status NOT IN ('resolvido', 'fechado')
ORDER BY prioridade, aberto_em;
