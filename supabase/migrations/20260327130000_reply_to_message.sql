-- Migration: Reply to Message
-- Adiciona suporte a responder mensagens (quote/reply) no livechat.
-- O campo quoted_message_id referencia a mensagem sendo respondida.
-- N8N usa os dados da mensagem citada para montar o payload correto
-- para Evolution API (quoted.key) e WhatsApp Cloud API (context.message_id).

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS quoted_message_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- Index para consultas de mensagens que são respostas
CREATE INDEX IF NOT EXISTS idx_messages_quoted_message_id
  ON messages (quoted_message_id)
  WHERE quoted_message_id IS NOT NULL;
