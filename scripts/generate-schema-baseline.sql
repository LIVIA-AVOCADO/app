-- GERADOR DE SCHEMA BASELINE
-- Rodar no SQL Editor da produção (dashboard.supabase.com)
-- Copiar o resultado e salvar como supabase/migrations/000000000000_baseline.sql
-- Depois aplicar no staging via SQL Editor do projeto livia-staging

DO $$
DECLARE
  result text := '';
BEGIN
  RAISE NOTICE '%', result;
END $$;

-- ============================================================
-- PARTE 1: Extensions
-- ============================================================
SELECT 'Parte 1: Extensions' as secao, string_agg(
  'CREATE EXTENSION IF NOT EXISTS ' || quote_ident(extname) || ';',
  E'\n' ORDER BY extname
) as ddl
FROM pg_extension
WHERE extname NOT IN ('plpgsql')
AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
OR extname IN ('uuid-ossp', 'pgcrypto', 'pg_trgm', 'unaccent', 'vector');
