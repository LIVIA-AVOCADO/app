-- Garante que INSERT/UPDATE em public.messages replicam para clients Realtime (postgres_changes).
-- Sem isto, useRealtimeMessages nunca recebe eventos mesmo com subscrição SUBSCRIBED.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
