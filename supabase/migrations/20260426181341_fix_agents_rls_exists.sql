-- BACKLOG-016: Corrigir RLS da tabela agents (vazamento entre tenants)
-- Causa: política anterior usava IN (subquery) que não funciona bem com RLS em SSR
-- Fix: usar EXISTS para garantir isolamento correto entre tenants

-- Remove políticas antigas se existirem (podem ter sido criadas manualmente no Supabase)
DROP POLICY IF EXISTS "Tenants can view agents from their neurocore" ON public.agents;
DROP POLICY IF EXISTS "agents_tenant_read" ON public.agents;
DROP POLICY IF EXISTS "agents_select_policy" ON public.agents;

-- Nova política usando EXISTS (funciona corretamente em SSR/server-side queries)
CREATE POLICY "agents_tenant_isolation"
ON public.agents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = auth.uid()
      AND t.neurocore_id = public.agents.id_neurocore
  )
);
