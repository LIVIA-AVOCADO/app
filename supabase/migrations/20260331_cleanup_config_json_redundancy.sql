-- ============================================================
-- Migration: limpeza de campos redundantes no config_json
-- ============================================================
-- 1. Remove company_name — valor idêntico a instance_name
--    (ambos vieram de provider_external_channel_id)
--
-- 2. Renomeia campo legado "instance" para "instance_id_api"
--    para clareza (era o identificador da instância na API
--    Evolution, não confundir com instance_name ou instance_id)
-- ============================================================

-- 1. Remove company_name dos canais Evolution
UPDATE public.channels
SET config_json = config_json - 'company_name'
WHERE channel_provider_id IN (
  SELECT id FROM public.channel_providers
  WHERE channel_provider_identifier_code LIKE 'evolution%'
)
AND config_json ? 'company_name';

-- 2. Renomeia "instance" → "instance_id_api"
UPDATE public.channels
SET config_json = (config_json - 'instance') || jsonb_build_object(
  'instance_id_api', config_json->>'instance'
)
WHERE channel_provider_id IN (
  SELECT id FROM public.channel_providers
  WHERE channel_provider_identifier_code LIKE 'evolution%'
)
AND config_json ? 'instance';
