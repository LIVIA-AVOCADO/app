-- ============================================================
-- PHASE 3 — Migration 3/3: Assignments, Queue, ALTER conversations
-- Pré-requisito: 20260425_phase3_teams.sql e
--                20260425_phase3_ura.sql aplicados.
-- Aplicar no Supabase SQL Editor antes de commitar.
-- ============================================================

-- Histórico de atribuições de conversa
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  attendant_id    uuid        REFERENCES attendants(id) ON DELETE SET NULL,
  team_id         uuid        REFERENCES teams(id) ON DELETE SET NULL,
  assigned_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  -- NULL = atribuído automaticamente pelo URA Engine
  reason          text        CHECK (reason IN (
                                'ura_rule', 'manual', 'transfer', 'overflow', 'sticky'
                              )),
  rule_id         uuid        REFERENCES ura_rules(id) ON DELETE SET NULL,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  unassigned_at   timestamptz
);

CREATE INDEX IF NOT EXISTS conversation_assignments_conversation_id_idx
  ON conversation_assignments (conversation_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS conversation_assignments_attendant_id_idx
  ON conversation_assignments (attendant_id) WHERE attendant_id IS NOT NULL;

ALTER TABLE conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_assignments REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "service_role_all" ON conversation_assignments;
CREATE POLICY "service_role_all" ON conversation_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON conversation_assignments;
CREATE POLICY "tenant_select" ON conversation_assignments
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- ============================================================

-- Fila de conversas aguardando atribuição
CREATE TABLE IF NOT EXISTS conversation_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_team_id  uuid        REFERENCES teams(id) ON DELETE SET NULL,
  target_type     text        NOT NULL DEFAULT 'any'
                                CHECK (target_type IN ('human', 'ai', 'any')),
  queued_at       timestamptz NOT NULL DEFAULT now(),
  auto_assign_at  timestamptz,
  is_active       boolean     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS conversation_queue_tenant_id_is_active_idx
  ON conversation_queue (tenant_id, is_active, queued_at ASC);

CREATE INDEX IF NOT EXISTS conversation_queue_conversation_id_idx
  ON conversation_queue (conversation_id);

ALTER TABLE conversation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_queue REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "service_role_all" ON conversation_queue;
CREATE POLICY "service_role_all" ON conversation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON conversation_queue;
CREATE POLICY "tenant_select" ON conversation_queue
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================

-- Novos campos em conversations (todos nullable — zero risco para dados existentes)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS team_id     uuid REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_assigned_to_idx
  ON conversations (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_team_id_idx
  ON conversations (team_id) WHERE team_id IS NOT NULL;
