-- Remove os chamados e o usuário criados pelos testes (títulos começam com "[teste]").
DELETE FROM ticket_history WHERE chamado_id IN (SELECT id FROM tickets WHERE titulo LIKE '[teste]%');
DELETE FROM tickets WHERE titulo LIKE '[teste]%';
DELETE FROM users WHERE email = 'teste.sla@helpdesk.local';
