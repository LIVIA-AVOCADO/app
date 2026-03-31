-- ============================================================
-- Migration: channels — consolidação de colunas em config_json
-- ============================================================
-- Remove colunas provider-specific da tabela e consolida todos
-- os dados em config_json, seguindo o contrato por provider:
--
-- Evolution API (evolution_001):
--   config_json.instance_name  ← provider_external_channel_id
--   config_json.company_name   ← instance_company_name
--   config_json.webhook_url    ← EVOLUTION_INSTANCE_WEBHOOK_URL
--
-- Meta Oficial WhatsApp (meta_oficial_whatsapp):
--   config_json.phone_number_id ← provider_external_channel_id
--   config_json.verified_name   ← instance_company_name
--
-- Ordem importa: dados migrados ANTES do DROP para evitar perda.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- FASE 1 — Evolution: migra dados para config_json
-- ──────────────────────────────────────────────────────────────
UPDATE public.channels
SET config_json = COALESCE(config_json, '{}') || jsonb_build_object(
  'instance_name', provider_external_channel_id,
  'company_name',  instance_company_name,
  'webhook_url',   'https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev'
)
WHERE channel_provider_id IN (
  SELECT id FROM public.channel_providers
  WHERE channel_provider_identifier_code LIKE 'evolution%'
)
AND provider_external_channel_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FASE 2 — Meta: migra dados para config_json
-- ──────────────────────────────────────────────────────────────
UPDATE public.channels
SET config_json = COALESCE(config_json, '{}') || jsonb_build_object(
  'phone_number_id', provider_external_channel_id,
  'verified_name',   instance_company_name
)
WHERE channel_provider_id IN (
  SELECT id FROM public.channel_providers
  WHERE channel_provider_identifier_code = 'meta_oficial_whatsapp'
)
AND provider_external_channel_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FASE 3 — Expression indexes para hot path do webhook
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS channels_evolution_instance_idx
  ON public.channels ((config_json->>'instance_name'));

CREATE INDEX IF NOT EXISTS channels_meta_phone_number_id_idx
  ON public.channels ((config_json->>'phone_number_id'));

-- ──────────────────────────────────────────────────────────────
-- FASE 4 — Remove colunas provider-specific
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.channels DROP COLUMN IF EXISTS provider_external_channel_id;
ALTER TABLE public.channels DROP COLUMN IF EXISTS instance_company_name;
ALTER TABLE public.channels DROP COLUMN IF EXISTS identification_channel_client_descriptions;
ALTER TABLE public.channels DROP COLUMN IF EXISTS external_api_url;

-- Atualiza comentário da coluna
COMMENT ON COLUMN public.channels.config_json IS
  'Configuração específica do provider. Estrutura por provider:
   - evolution_*: { "instance_name": "livia-xxx", "instance_id": "uuid", "instance_id_api": "legado", "apikey_instance": "...", "webhook_url": "...", "evolution_api_url": "...", "client_description": "...", "settings": { ... } }
   - meta_oficial_whatsapp: { "phone_number_id": "...", "access_token": "...", "verified_name": "...", "webhook_url": "..." }';
