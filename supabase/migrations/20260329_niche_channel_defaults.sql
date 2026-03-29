-- ============================================================
-- Migration: niche_channel_defaults + niche_id nos templates
-- ============================================================

-- 1. Adicionar nicho "Geral" (existia só nos templates)
INSERT INTO public.niches (name, description)
VALUES ('Geral', 'Nicho genérico para uso geral')
ON CONFLICT DO NOTHING;

-- 2. Tabela de defaults de canal por nicho (seed do onboarding)
CREATE TABLE IF NOT EXISTS public.niche_channel_defaults (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id            uuid        NOT NULL REFERENCES public.niches(id),
  channel_type_id     uuid        NOT NULL REFERENCES public.channel_types(id),
  channel_provider_id uuid        NOT NULL REFERENCES public.channel_providers(id),
  neurocore_id        uuid        NOT NULL REFERENCES public.neurocores(id),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (niche_id, channel_type_id)
);

COMMENT ON TABLE public.niche_channel_defaults IS
  'Configuração padrão de onboarding por nicho e tipo de canal.
   Usado apenas para pré-preencher a criação do canal durante o onboarding.
   Após a ativação o tenant gerencia seus canais de forma independente em public.channels.';

-- 3. Seed: todos os nichos → WhatsApp via Evolution API 2.3.6
-- Neurocores copiados dos templates existentes por nicho
INSERT INTO public.niche_channel_defaults
  (niche_id, channel_type_id, channel_provider_id, neurocore_id)
SELECT
  n.id                                      AS niche_id,
  (SELECT id FROM public.channel_types
   WHERE name = 'whatsapp')                 AS channel_type_id,
  '076b2291-d532-41b0-8b41-a2f721e22ea5'   AS channel_provider_id,  -- Evolution API 2.3.6
  t.default_neurocore_id                    AS neurocore_id
FROM public.niches n
JOIN onboarding.onboarding_templates t
  ON LOWER(t.niche) = LOWER(n.name)
ON CONFLICT (niche_id, channel_type_id) DO NOTHING;

-- 4. Adicionar niche_id (FK) em onboarding_templates
ALTER TABLE onboarding.onboarding_templates
  ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES public.niches(id);

-- Vincular templates existentes aos seus niches via match de nome
UPDATE onboarding.onboarding_templates t
SET niche_id = n.id
FROM public.niches n
WHERE LOWER(t.niche) = LOWER(n.name)
  AND t.niche_id IS NULL;

-- Desativar template "Geral" (substituído pelo nicho Geral)
UPDATE onboarding.onboarding_templates
SET is_active = false
WHERE LOWER(niche) = 'geral';

COMMENT ON COLUMN onboarding.onboarding_templates.niche_id IS
  'FK para public.niches. Substitui progressivamente o campo niche (text).
   O campo niche (text) é mantido por compatibilidade durante a transição.';
