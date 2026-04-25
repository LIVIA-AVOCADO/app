-- Garante que RLS está ativado na tabela tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Permite que usuarios autenticados leiam o tenant ao qual pertencem
-- Subquery: busca o tenant_id do usuario logado na tabela users
DROP POLICY IF EXISTS "Users can read own tenant" ON tenants;
CREATE POLICY "Users can read own tenant"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
