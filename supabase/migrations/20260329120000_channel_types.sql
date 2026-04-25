-- ============================================================
-- Migration: channel_types + vincular channel_providers ao tipo
-- ============================================================

-- 1. Tabela de tipos de canal
CREATE TABLE IF NOT EXISTS public.channel_types (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,  -- 'whatsapp', 'instagram', 'sms'
  display_name text        NOT NULL,
  icon         text,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed inicial
INSERT INTO public.channel_types (name, display_name, icon) VALUES
  ('whatsapp',   'WhatsApp',   'message-circle'),
  ('instagram',  'Instagram',  'instagram'),
  ('sms',        'SMS',        'message-square')
ON CONFLICT (name) DO NOTHING;

-- 2. Adicionar channel_type_id em channel_providers
ALTER TABLE public.channel_providers
  ADD COLUMN IF NOT EXISTS channel_type_id uuid REFERENCES public.channel_types(id);

-- Vincular providers existentes ao tipo whatsapp
UPDATE public.channel_providers
SET channel_type_id = (SELECT id FROM public.channel_types WHERE name = 'whatsapp')
WHERE channel_type_id IS NULL;

-- Tornar obrigatório
ALTER TABLE public.channel_providers
  ALTER COLUMN channel_type_id SET NOT NULL;

COMMENT ON TABLE public.channel_types IS
  'Tipos de canal suportados pelo sistema (WhatsApp, Instagram, SMS...).
   channel_providers são vinculados a um channel_type.';

COMMENT ON COLUMN public.channel_providers.channel_type_id IS
  'Tipo de canal que este provider entrega (ex: Evolution → whatsapp).';
