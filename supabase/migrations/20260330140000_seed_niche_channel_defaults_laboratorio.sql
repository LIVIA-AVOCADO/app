-- ============================================================
-- Migration: seed niche_channel_defaults para niche Laboratório
-- ============================================================
-- Insere o mapeamento do niche "Laboratório" com o provedor Evolution API
-- e o neurocore "Laboratorio de Analises Clinicas - 01".
-- Idempotente — seguro para rodar mais de uma vez.
-- ============================================================

INSERT INTO public.niche_channel_defaults
  (niche_id, channel_provider_id, channel_type_id, neurocore_id, is_active)
SELECT
  (SELECT id FROM public.niches WHERE name ILIKE 'Laboratório%' LIMIT 1),
  (SELECT id FROM public.channel_providers WHERE channel_provider_identifier_code = 'evolution_001'),
  (SELECT id FROM public.channel_types WHERE name = 'whatsapp'),
  (SELECT id FROM public.neurocores WHERE name ILIKE 'Laboratorio de Analises Clinicas - 01' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.niche_channel_defaults
  WHERE niche_id = (SELECT id FROM public.niches WHERE name ILIKE 'Laboratório%' LIMIT 1)
    AND channel_provider_id = (SELECT id FROM public.channel_providers WHERE channel_provider_identifier_code = 'evolution_001')
);
