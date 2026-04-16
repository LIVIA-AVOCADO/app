-- Migration: Message content search via pg_trgm
-- Tenant isolation via JOIN conversations.tenant_id (messages has no tenant_id column)

-- 1. pg_trgm (already available in Supabase, idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index on messages.content
--    Activates for ILIKE '%query%' when query >= 3 chars
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages
  USING GIN (content gin_trgm_ops);

-- 3. RPC: search messages by content within a tenant
--    Returns one row per matching message with conversation + contact info + snippet
CREATE OR REPLACE FUNCTION public.search_messages_by_content(
  p_tenant_id   uuid,
  p_query       text,
  p_limit       int  DEFAULT 20,
  p_offset      int  DEFAULT 0
)
RETURNS TABLE (
  message_id          uuid,
  conversation_id     uuid,
  message_snippet     text,
  message_timestamp   timestamptz,
  contact_id          uuid,
  contact_name        text,
  contact_phone       text,
  conversation_status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.id                    AS message_id,
    m.conversation_id       AS conversation_id,
    substring(
      m.content
      FROM GREATEST(1, position(lower(p_query) IN lower(m.content)) - 40)
      FOR 120
    )                       AS message_snippet,
    m.timestamp             AS message_timestamp,
    ct.id                   AS contact_id,
    ct.name                 AS contact_name,
    ct.phone                AS contact_phone,
    c.status::text          AS conversation_status
  FROM public.messages m
  INNER JOIN public.conversations c
    ON c.id = m.conversation_id
   AND c.tenant_id = p_tenant_id
  INNER JOIN public.contacts ct
    ON ct.id = c.contact_id
  WHERE m.content ILIKE ('%' || p_query || '%')
    AND length(p_query) >= 3
  ORDER BY m.timestamp DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION public.search_messages_by_content(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_messages_by_content(uuid, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_messages_by_content(uuid, text, int, int) TO service_role;

COMMENT ON FUNCTION public.search_messages_by_content(uuid, text, int, int) IS
  'Trigram search over messages.content within a tenant. Uses GIN index. Min query: 3 chars.';
