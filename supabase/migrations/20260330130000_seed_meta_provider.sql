-- ============================================================
-- Migration: seed provedor Meta Oficial WhatsApp
-- ============================================================
-- Insere a linha 'meta_oficial_whatsapp' em channel_providers caso
-- ainda não exista. Idempotente — seguro para rodar mais de uma vez.
--
-- Depende de:
--   - public.channel_types (criado em 20260329_channel_types.sql)
--   - channel_providers.channel_type_id NOT NULL constraint
-- ============================================================

INSERT INTO public.channel_providers
  (name, description, channel_provider_identifier_code, channel_type_id)
SELECT
  'Meta Oficial WhatsApp',
  'WhatsApp Business Cloud API via Meta for Developers',
  'meta_oficial_whatsapp',
  (SELECT id FROM public.channel_types WHERE name = 'whatsapp')
WHERE NOT EXISTS (
  SELECT 1 FROM public.channel_providers
  WHERE channel_provider_identifier_code = 'meta_oficial_whatsapp'
);
