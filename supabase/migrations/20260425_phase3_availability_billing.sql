-- ============================================================
-- PHASE 3 — Migration 4/4: Disponibilidade de agentes + Billing config
-- Aplicar no Supabase SQL Editor antes de commitar.
-- ============================================================

-- Disponibilidade do agente (manual — o sistema nunca altera automaticamente)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'offline'
    CHECK (availability_status IN ('online', 'busy', 'offline')),
  ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz;

-- Flag para usuários internos da equipe LIVIA (excluídos da cobrança do tenant)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_availability_status_idx
  ON users (availability_status) WHERE availability_status != 'offline';

CREATE INDEX IF NOT EXISTS users_is_internal_idx
  ON users (is_internal) WHERE is_internal = true;

-- ============================================================
-- Configurações globais da plataforma (editável via admin_livia)
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_configs (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preço por seat com acesso ao inbox (em centavos — 2000 = R$ 20,00)
INSERT INTO platform_configs (key, value)
VALUES ('inbox_seat_price_brl_cents', '2000')
ON CONFLICT (key) DO NOTHING;

-- RLS: apenas service_role lê/escreve (admin_livia usa service role)
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON platform_configs;
CREATE POLICY "service_role_all" ON platform_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Autenticados podem ler (necessário para o frontend calcular billing)
DROP POLICY IF EXISTS "authenticated_select" ON platform_configs;
CREATE POLICY "authenticated_select" ON platform_configs
  FOR SELECT TO authenticated USING (true);
