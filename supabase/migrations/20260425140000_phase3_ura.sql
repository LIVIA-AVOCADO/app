-- ============================================================
-- PHASE 3 — Migration 2/3: URA Configs e URA Rules
-- Pré-requisito: 20260425_phase3_teams.sql aplicado.
-- Aplicar no Supabase SQL Editor antes de commitar.
-- ============================================================

-- Configuração URA por tenant (1 linha por tenant)
CREATE TABLE IF NOT EXISTS ura_configs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  mode                    text        NOT NULL DEFAULT 'direct'
                            CHECK (mode IN ('ura', 'intent_agent', 'direct')),
  default_ai_attendant_id uuid        REFERENCES attendants(id) ON DELETE SET NULL,
  business_hours          jsonb       NOT NULL DEFAULT '{}',
  -- { "mon":{"from":"08:00","to":"18:00"}, "sat":null, "sun":null, ... }
  outside_hours_action    text        NOT NULL DEFAULT 'queue'
                            CHECK (outside_hours_action IN ('queue', 'ai', 'auto_reply', 'reject')),
  outside_hours_message   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ura_configs_tenant_id_idx
  ON ura_configs (tenant_id);

DROP TRIGGER IF EXISTS ura_configs_updated_at ON ura_configs;
CREATE OR REPLACE FUNCTION update_ura_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER ura_configs_updated_at
  BEFORE UPDATE ON ura_configs
  FOR EACH ROW EXECUTE FUNCTION update_ura_configs_updated_at();

ALTER TABLE ura_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON ura_configs;
CREATE POLICY "service_role_all" ON ura_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON ura_configs;
CREATE POLICY "tenant_select" ON ura_configs
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_insert" ON ura_configs;
CREATE POLICY "tenant_insert" ON ura_configs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_update" ON ura_configs;
CREATE POLICY "tenant_update" ON ura_configs
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================

-- Regras de roteamento
CREATE TABLE IF NOT EXISTS ura_rules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  priority      int         NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  conditions    jsonb       NOT NULL DEFAULT '[]',
  -- [{"type":"channel_id","op":"eq","value":"uuid"},
  --  {"type":"contact_tag","op":"has","value":"vip"},
  --  {"type":"first_message_keyword","op":"contains_any","value":["suporte"]},
  --  {"type":"time_range","op":"within","value":{"from":"08:00","to":"18:00","tz":"America/Sao_Paulo"}},
  --  {"type":"outside_hours","op":"eq","value":true},
  --  {"type":"contact_is_returning","op":"eq","value":true},
  --  {"type":"conversation_count","op":"gte","value":3}]
  action_type   text        NOT NULL
                  CHECK (action_type IN (
                    'assign_team', 'assign_agent', 'assign_percentage',
                    'route_ai', 'queue', 'auto_reply'
                  )),
  action_config jsonb       NOT NULL DEFAULT '{}',
  -- assign_team:       {"team_id":"uuid","strategy":"round_robin"}
  -- assign_agent:      {"agent_id":"uuid"}
  -- assign_percentage: {"buckets":[{"team_id":"A","pct":70},{"team_id":"B","pct":30}]}
  -- route_ai:          {"attendant_id":"uuid"}
  -- queue:             {"target_team_id":"uuid"}
  -- auto_reply:        {"message":"Olá! Em breve retornamos."}
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ura_rules_tenant_id_is_active_priority_idx
  ON ura_rules (tenant_id, is_active, priority ASC);

DROP TRIGGER IF EXISTS ura_rules_updated_at ON ura_rules;
CREATE OR REPLACE FUNCTION update_ura_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER ura_rules_updated_at
  BEFORE UPDATE ON ura_rules
  FOR EACH ROW EXECUTE FUNCTION update_ura_rules_updated_at();

ALTER TABLE ura_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON ura_rules;
CREATE POLICY "service_role_all" ON ura_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON ura_rules;
CREATE POLICY "tenant_select" ON ura_rules
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_insert" ON ura_rules;
CREATE POLICY "tenant_insert" ON ura_rules
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_update" ON ura_rules;
CREATE POLICY "tenant_update" ON ura_rules
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_delete" ON ura_rules;
CREATE POLICY "tenant_delete" ON ura_rules
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
