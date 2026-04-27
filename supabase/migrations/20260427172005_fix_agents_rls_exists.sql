-- Fix BACKLOG-016: troca IN (subquery) por EXISTS na policy da tabela agents
--
-- Problema: IN (subquery) pode não filtrar corretamente em contexto SSR
-- e é menos eficiente que EXISTS. A nova policy usa EXISTS com
-- (SELECT auth.uid()) para evitar re-avaliação por linha.

DROP POLICY IF EXISTS "tenants_can_view_their_agents" ON "public"."agents";

CREATE POLICY "tenants_can_view_their_agents"
ON "public"."agents"
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.users u ON u.tenant_id = t.id
    WHERE u.id = (SELECT auth.uid())
    AND t.neurocore_id = id_neurocore
  )
);
