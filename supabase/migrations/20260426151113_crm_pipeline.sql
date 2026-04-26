-- ============================================================
-- MIGRATION: CRM — Pipeline + Histórico + Métricas
-- ============================================================

-- Estágios do pipeline por tenant
CREATE TABLE pipeline_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color         text NOT NULL DEFAULT '#6366f1',
  display_order int NOT NULL DEFAULT 0,
  is_closed     boolean NOT NULL DEFAULT false,
  is_won        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON pipeline_stages (tenant_id, display_order);

-- Vincular conversas ao pipeline
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage_id uuid REFERENCES pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS deal_value        numeric(12,2),
  ADD COLUMN IF NOT EXISTS deal_currency     text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS stage_moved_at    timestamptz;

CREATE INDEX ON conversations (pipeline_stage_id) WHERE pipeline_stage_id IS NOT NULL;

-- Histórico de movimentações no pipeline
CREATE TABLE pipeline_stage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  from_stage_id   uuid REFERENCES pipeline_stages(id),
  to_stage_id     uuid REFERENCES pipeline_stages(id),
  moved_by        uuid REFERENCES auth.users(id),
  moved_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON pipeline_stage_history (conversation_id, moved_at DESC);
CREATE INDEX ON pipeline_stage_history (tenant_id, moved_at DESC);

-- Snapshots diários de métricas
CREATE TABLE metrics_daily (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  total_conversations   int NOT NULL DEFAULT 0,
  closed_conversations  int NOT NULL DEFAULT 0,
  ai_handled            int NOT NULL DEFAULT 0,
  human_handled         int NOT NULL DEFAULT 0,
  avg_first_response_s  int,
  avg_resolution_s      int,
  csat_positive         int NOT NULL DEFAULT 0,
  csat_negative         int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, date)
);

CREATE INDEX ON metrics_daily (tenant_id, date DESC);

-- RLS
ALTER TABLE pipeline_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily         ENABLE ROW LEVEL SECURITY;

-- Seed: estágios padrão para tenants existentes
-- (novos tenants podem ser criados via UI)
INSERT INTO pipeline_stages (tenant_id, name, color, display_order, is_closed, is_won)
SELECT
  id,
  unnest(ARRAY['Lead', 'Negociando', 'Proposta Enviada', 'Fechado', 'Perdido']) AS name,
  unnest(ARRAY['#6366f1', '#f59e0b', '#3b82f6', '#22c55e', '#ef4444']) AS color,
  generate_series(0, 4) AS display_order,
  unnest(ARRAY[false, false, false, true, true]) AS is_closed,
  unnest(ARRAY[false, false, false, true, false]) AS is_won
FROM tenants;
