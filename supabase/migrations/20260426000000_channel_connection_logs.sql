-- ============================================================
-- MIGRATION: channel_connection_logs (Fase 4)
-- ============================================================
-- Aplicar ANTES de commitar: Supabase SQL Editor → executar → confirmar sem erros
-- Verificar: SELECT COUNT(*) FROM channel_connection_logs;

CREATE TABLE IF NOT EXISTS channel_connection_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  channel_id  uuid REFERENCES channels(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  -- 'connected' | 'disconnected' | 'qr_generated' | 'qr_expired'
  -- 'message_received' | 'message_sent' | 'message_failed'
  -- 'webhook_received' | 'webhook_error' | 'reconnect_attempt'
  event_data  jsonb DEFAULT '{}',
  source      text NOT NULL DEFAULT 'system',
  -- 'evolution' | 'meta' | 'go_gateway' | 'system'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_logs_channel_created
  ON channel_connection_logs (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_logs_tenant_created
  ON channel_connection_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_logs_event_type_created
  ON channel_connection_logs (event_type, created_at DESC);

ALTER TABLE channel_connection_logs REPLICA IDENTITY FULL;
