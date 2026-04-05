-- Motivo informado pelo atendente ao silenciar (auditoria / contexto)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS mute_reason text;
