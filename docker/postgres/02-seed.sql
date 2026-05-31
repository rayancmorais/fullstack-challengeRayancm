-- Seed da wallet do usuário de teste "player".
--
-- ATENÇÃO: este arquivo NÃO roda no startup do PostgreSQL.
-- Os scripts de initdb rodam antes das migrations do Prisma,
-- então a tabela "wallets" ainda não existe nesse momento.
--
-- A execução real acontece via "bunx prisma db seed" no Dockerfile
-- do wallets service, logo após "prisma migrate deploy".
--
-- Este arquivo existe como documentação do SQL equivalente ao seed.
-- Para rodar manualmente contra um banco que já tem a migration aplicada:
--   psql postgresql://admin:admin@localhost:5432/wallets -f docker/postgres/02-seed.sql

\connect wallets

INSERT INTO wallets (id, "playerId", username, balance, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'c785afb7-b513-40e4-88df-b7b840400515',
  'player',
  100000,
  now(),
  now()
) ON CONFLICT ("playerId") DO NOTHING;
