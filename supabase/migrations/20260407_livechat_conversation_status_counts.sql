-- Contagens das abas do livechat (IA / manual / encerradas / importantes / não lidas em manual).
-- Usa agregação no Postgres para não depender do limite de linhas do PostgREST (~1000).
-- Mesma lógica que ContactList: exclui contatos silenciados (is_muted).

CREATE OR REPLACE FUNCTION public.livechat_conversation_status_counts(p_tenant_id uuid)
RETURNS TABLE (
  ia_count bigint,
  manual_count bigint,
  closed_count bigint,
  important_count bigint,
  unread_manual_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE c.ia_active IS TRUE AND c.status IS DISTINCT FROM 'closed'
    )::bigint AS ia_count,
    COUNT(*) FILTER (
      WHERE c.ia_active IS NOT TRUE AND c.status IS DISTINCT FROM 'closed'
    )::bigint AS manual_count,
    COUNT(*) FILTER (WHERE c.status = 'closed')::bigint AS closed_count,
    COUNT(*) FILTER (
      WHERE c.is_important IS TRUE AND c.status IS DISTINCT FROM 'closed'
    )::bigint AS important_count,
    COUNT(*) FILTER (
      WHERE c.ia_active IS NOT TRUE
        AND c.status IS DISTINCT FROM 'closed'
        AND c.has_unread IS TRUE
    )::bigint AS unread_manual_count
  FROM public.conversations c
  INNER JOIN public.contacts ct
    ON ct.id = c.contact_id
   AND ct.tenant_id = c.tenant_id
  WHERE c.tenant_id = p_tenant_id
    AND COALESCE(ct.is_muted, false) = false;
$$;

REVOKE ALL ON FUNCTION public.livechat_conversation_status_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.livechat_conversation_status_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.livechat_conversation_status_counts(uuid) TO service_role;

COMMENT ON FUNCTION public.livechat_conversation_status_counts(uuid) IS
  'Contagens por aba do livechat; respeita RLS; não limitado pelo max rows do PostgREST.';
