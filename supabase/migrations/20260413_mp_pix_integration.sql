-- ============================================================
-- Mercado Pago PIX Integration
-- Adiciona suporte a múltiplos provedores de assinatura
-- e tabela de pagamentos PIX avulsos
-- ============================================================

-- 1. Novos campos no tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_provider    TEXT    NOT NULL DEFAULT 'stripe'
    CHECK (subscription_provider IN ('stripe', 'pix_manual')),
  ADD COLUMN IF NOT EXISTS subscription_billing_day INTEGER
    CHECK (subscription_billing_day BETWEEN 1 AND 31);

COMMENT ON COLUMN tenants.subscription_provider IS
  'Provedor ativo da assinatura: stripe (cartão, débito automático) ou pix_manual (PIX mensal com lembrete)';

COMMENT ON COLUMN tenants.subscription_billing_day IS
  'Dia fixo do mês para cobrança. Espelho do billing_cycle_anchor do Stripe. Meses com menos dias usam o último dia disponível.';

-- Popula billing_day para tenants que já possuem period_end
UPDATE tenants
SET subscription_billing_day = EXTRACT(DAY FROM subscription_current_period_end)
WHERE subscription_current_period_end IS NOT NULL
  AND subscription_billing_day IS NULL;

-- ============================================================
-- 2. Tabela de pagamentos PIX avulsos (recargas de crédito)
-- ============================================================

CREATE TABLE IF NOT EXISTS mp_pix_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mp_payment_id   TEXT        NOT NULL UNIQUE,
  payment_type    TEXT        NOT NULL DEFAULT 'credit_purchase'
    CHECK (payment_type IN ('credit_purchase', 'subscription')),
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  amount_cents    INTEGER     NOT NULL,
  credits         INTEGER     NOT NULL DEFAULT 0,
  qr_code         TEXT,
  qr_code_base64  TEXT,
  expires_at      TIMESTAMPTZ,
  meta            JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mp_pix_payments_tenant_id_idx    ON mp_pix_payments(tenant_id);
CREATE INDEX IF NOT EXISTS mp_pix_payments_mp_payment_id_idx ON mp_pix_payments(mp_payment_id);
CREATE INDEX IF NOT EXISTS mp_pix_payments_status_idx        ON mp_pix_payments(status);

-- Auto-atualiza updated_at
CREATE OR REPLACE FUNCTION update_mp_pix_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mp_pix_payments_updated_at ON mp_pix_payments;
CREATE TRIGGER mp_pix_payments_updated_at
  BEFORE UPDATE ON mp_pix_payments
  FOR EACH ROW EXECUTE FUNCTION update_mp_pix_payments_updated_at();

-- RLS
ALTER TABLE mp_pix_payments ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total (webhooks, APIs server-side)
CREATE POLICY "service_role_all" ON mp_pix_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários autenticados leem apenas os registros do próprio tenant
CREATE POLICY "tenant_select" ON mp_pix_payments
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
