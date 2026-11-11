-- Remove os chamados criados pelos testes automatizados e pelos seeds.
-- (todos têm o título começando com "[teste]")

-- PostgreSQL:
DELETE FROM chamados WHERE titulo LIKE '[teste]%';

-- Azure SQL (no T-SQL o "[" é especial no LIKE, por isso "[[]"):
-- DELETE FROM chamados WHERE titulo LIKE '[[]teste]%';
