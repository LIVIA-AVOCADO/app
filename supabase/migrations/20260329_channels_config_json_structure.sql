-- ============================================================
-- Migration: channels.config_json — estrutura por provider
-- ============================================================
-- Cada provider tem uma estrutura específica esperada em config_json:
--
-- Meta Oficial WhatsApp (meta_oficial_whatsapp):
--   {
--     "access_token": "EAAA..."   -- token de acesso da app Meta / Signum
--   }
--   OBS: phone_number_id já está em provider_external_channel_id
--
-- Evolution API (evolution_001):
--   {
--     "instance": "DF95B747EA0F-..."  -- nome da instância Evolution
--   }
--   OBS: espelha provider_external_channel_id; mantido em config_json
--        para leitura uniforme nos workflows do n8n
-- ============================================================

-- 1. Documentar o contrato da coluna
COMMENT ON COLUMN public.channels.config_json IS
  'Configuração específica do provider. Estrutura esperada por provider:
   - meta_oficial_whatsapp: { "access_token": "EAAA..." }
   - evolution_001:          { "instance": "<nome-da-instancia>" }
   O campo provider_external_channel_id armazena o phone_number_id (Meta)
   ou o instance ID (Evolution) — config_json contém apenas credenciais extras.';

-- 2. Inicializar canais Meta: estrutura com access_token null (preencher manualmente)
UPDATE public.channels
SET config_json = jsonb_build_object('access_token', null)
WHERE
  channel_provider_id = (
    SELECT id FROM public.channel_providers
    WHERE channel_provider_identifier_code = 'meta_oficial_whatsapp'
  )
  AND config_json IS NULL;

-- 3. Inicializar canais Evolution: instance = provider_external_channel_id
UPDATE public.channels
SET config_json = jsonb_build_object('instance', provider_external_channel_id)
WHERE
  channel_provider_id = (
    SELECT id FROM public.channel_providers
    WHERE channel_provider_identifier_code = 'evolution_001'
  )
  AND config_json IS NULL
  AND provider_external_channel_id IS NOT NULL;
