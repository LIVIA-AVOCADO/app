-- Migration: Garante a FK constraint em messages.quoted_message_id
--
-- Contexto: a migration 20260327_reply_to_message.sql usa ADD COLUMN IF NOT EXISTS,
-- que pula o statement inteiro (inclusive a REFERENCES) se a coluna já existia.
-- Sem a FK, PostgREST não consegue resolver o self-join com o hint
-- "messages_quoted_message_id_fkey", gerando erro PGRST200 em produção.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'messages'
      AND constraint_name = 'messages_quoted_message_id_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_quoted_message_id_fkey
      FOREIGN KEY (quoted_message_id)
      REFERENCES messages(id)
      ON DELETE SET NULL;
  END IF;
END $$;
