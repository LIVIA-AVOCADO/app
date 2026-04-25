-- ============================================================
-- Migration: atualiza RPC get_channel_evolution_by_instance_id
-- ============================================================
-- Antes: buscava por config_json->>'instance' (apikey legado),
--        parâmetro chamado p_instance_id.
-- Depois: busca por config_json->>'instance_name' (campo canônico
--         presente em canais antigos via migration de consolidação
--         e em canais novos via create route).
--
-- O n8n envia body.instance (nome da instância Evolution) como
-- p_instance_name — ex: "Teste 01" ou "livia-abc123".
--
-- Mantém fallback em config_json->>'instance' para compatibilidade
-- com eventuais chamadas ainda usando o valor legado.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_channel_evolution_by_instance_id(text);

CREATE OR REPLACE FUNCTION public.get_channel_evolution_by_instance_id(
  p_instance_name text
)
RETURNS SETOF public.channels
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.channels
  WHERE (
    config_json->>'instance_name' = p_instance_name
    OR config_json->>'instance'   = p_instance_name
  )
    AND is_active = true
  LIMIT 1;
$$;
