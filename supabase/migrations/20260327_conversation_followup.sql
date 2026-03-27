-- Migration: Follow Up Automático de Conversa
-- Permite agendar um follow up automático para uma conversa.
-- O N8N é responsável por disparar a mensagem no horário agendado.

CREATE TABLE IF NOT EXISTS conversation_followups (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scheduled_at     timestamptz NOT NULL,
  message          text,                          -- null quando ai_generate = true
  ai_generate      boolean     NOT NULL DEFAULT false,
  cancel_on_reply  boolean     NOT NULL DEFAULT true,
  is_done          boolean     NOT NULL DEFAULT false,
  done_at          timestamptz,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Garante no máximo 1 follow-up ativo por conversa
CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_conversation_active
  ON conversation_followups (conversation_id)
  WHERE is_done = false;

-- Index para o N8N buscar follow-ups pendentes por tenant
CREATE INDEX IF NOT EXISTS idx_followup_scheduled
  ON conversation_followups (tenant_id, scheduled_at)
  WHERE is_done = false;

-- RLS
ALTER TABLE conversation_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage their followups"
  ON conversation_followups
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
