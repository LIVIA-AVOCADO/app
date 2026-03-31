-- ============================================================
-- Migration: fix RPC get_channel_evolution_by_instance_id
-- ============================================================
-- Problema: a versão anterior retornava SETOF public.channels,
--   que NÃO contém os campos de channel_providers necessários
--   para o n8n (id_subwork_n8n_master_integrator,
--   channel_provider_identifier_code).
--
-- Correção: JOIN com channel_providers e retorno como SETOF jsonb,
--   incluindo todos os campos de channels + os campos do provider
--   no mesmo nível (flat). Isso mantém compatibilidade com o
--   consumo via PostgREST / n8n.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_channel_evolution_by_instance_id(text);

CREATE OR REPLACE FUNCTION public.get_channel_evolution_by_instance_id(
  p_instance_name text
)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT to_jsonb(c.*) || jsonb_build_object(
    'channel_provider_identifier_code', cp.channel_provider_identifier_code,
    'id_subwork_n8n_master_integrator', cp.id_subwork_n8n_master_integrator,
    'api_base_config', cp.api_base_config
  )
  FROM public.channels c
  INNER JOIN public.channel_providers cp ON cp.id = c.channel_provider_id
  WHERE (
    c.config_json->>'instance_name' = p_instance_name
    OR c.config_json->>'instance_id_api' = p_instance_name
  )
    AND c.is_active = true
  LIMIT 1;
$$;
