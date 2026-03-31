-- ============================================================
-- Migration: adiciona evolution_api_url ao config_json
-- ============================================================
-- A coluna external_api_url (que continha a URL do servidor
-- Evolution API) foi mapeada incorretamente para
-- config_json.webhook_url na consolidação. O webhook_url
-- recebeu o valor do n8n webhook, e a URL da Evolution API
-- foi perdida.
--
-- Esta migration adiciona evolution_api_url ao config_json
-- de todos os canais Evolution existentes.
-- ============================================================

UPDATE public.channels
SET config_json = COALESCE(config_json, '{}') || jsonb_build_object(
  'evolution_api_url', 'https://wsapilocal2.ligeira.net'
)
WHERE channel_provider_id IN (
  SELECT id FROM public.channel_providers
  WHERE channel_provider_identifier_code LIKE 'evolution%'
)
AND (config_json->>'evolution_api_url' IS NULL);
