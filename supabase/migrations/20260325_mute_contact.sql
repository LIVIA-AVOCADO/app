-- Migration: Silenciar Contato
-- Adiciona campos de mute na tabela contacts para a feature de silenciar contatos inconvenientes.
-- Quando is_muted=true, o n8n descarta mensagens do contato sem processar.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_muted  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS muted_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index para o n8n consultar rapidamente por phone + tenant quando is_muted=true
-- (partial index: só indexa os silenciados, mantendo o índice pequeno)
CREATE INDEX IF NOT EXISTS idx_contacts_is_muted
  ON contacts (tenant_id, phone)
  WHERE is_muted = true;
