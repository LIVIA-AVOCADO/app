-- Migration: Garante a FK constraint em messages.sender_user_id → users.id
--
-- Contexto: a coluna sender_user_id provavelmente foi criada manualmente sem
-- a cláusula REFERENCES, então não existe a FK constraint. Sem ela, PostgREST
-- não consegue resolver o join com o hint "messages_sender_user_id_fkey",
-- gerando erro PGRST200 — o chat abre vazio mesmo com mensagens existindo.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'messages'
      AND constraint_name = 'messages_sender_user_id_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_sender_user_id_fkey
      FOREIGN KEY (sender_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
