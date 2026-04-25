-- ============================================================
-- PHASE 3 — Migration 1/3: Teams, Team Members, Attendants
-- Aplicar no Supabase SQL Editor antes de commitar.
-- ============================================================

-- Times / departamentos
CREATE TABLE IF NOT EXISTS teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  color       text        NOT NULL DEFAULT '#6366f1',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_tenant_id_is_active_idx
  ON teams (tenant_id, is_active);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON teams;
CREATE POLICY "service_role_all" ON teams
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON teams;
CREATE POLICY "tenant_select" ON teams
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_insert" ON teams;
CREATE POLICY "tenant_insert" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_update" ON teams;
CREATE POLICY "tenant_update" ON teams
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================

-- Membros de times
CREATE TABLE IF NOT EXISTS team_members (
  team_id                     uuid    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id                     uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                        text    NOT NULL DEFAULT 'agent',
  -- 'agent' | 'supervisor' | 'admin'
  skills                      text[]  NOT NULL DEFAULT '{}',
  is_available                boolean NOT NULL DEFAULT true,
  max_concurrent_conversations int    NOT NULL DEFAULT 10,
  joined_at                   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx
  ON team_members (user_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON team_members;
CREATE POLICY "service_role_all" ON team_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON team_members;
CREATE POLICY "tenant_select" ON team_members
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT id FROM teams
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tenant_insert" ON team_members;
CREATE POLICY "tenant_insert" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tenant_update" ON team_members;
CREATE POLICY "tenant_update" ON team_members
  FOR UPDATE TO authenticated
  USING (
    team_id IN (
      SELECT id FROM teams
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- ============================================================

-- Atendentes unificados (humano + IA)
CREATE TABLE IF NOT EXISTS attendants (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type             text        NOT NULL CHECK (type IN ('human', 'ai')),

  -- Para type='human':
  user_id          uuid        REFERENCES users(id) ON DELETE SET NULL,

  -- Para type='ai':
  ai_name          text,
  n8n_webhook_path text,

  -- Comum:
  team_id          uuid        REFERENCES teams(id) ON DELETE SET NULL,
  skills           text[]      NOT NULL DEFAULT '{}',
  max_concurrent   int         NOT NULL DEFAULT 10,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendants_tenant_id_type_is_active_idx
  ON attendants (tenant_id, type, is_active);

CREATE INDEX IF NOT EXISTS attendants_user_id_idx
  ON attendants (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON attendants;
CREATE POLICY "service_role_all" ON attendants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON attendants;
CREATE POLICY "tenant_select" ON attendants
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_insert" ON attendants;
CREATE POLICY "tenant_insert" ON attendants
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_update" ON attendants;
CREATE POLICY "tenant_update" ON attendants
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
