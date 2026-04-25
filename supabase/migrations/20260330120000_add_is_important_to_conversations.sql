-- Migration: Marcar Conversa como Importante
-- Adiciona flag is_important na tabela conversations para a feature de destacar
-- conversas recorrentes/prioritárias, similar ao "fixar" do WhatsApp.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

-- Partial index: só indexa as marcadas como importantes, mantém o índice pequeno
CREATE INDEX IF NOT EXISTS idx_conversations_is_important
  ON conversations (tenant_id)
  WHERE is_important = true;
