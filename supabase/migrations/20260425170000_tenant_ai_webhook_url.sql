-- Adiciona ai_webhook_url ao tenant para o URA Engine chamar diretamente
-- o webhook do Neurocore associado ao tenant, sem passar pelo FirstIntegration.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ai_webhook_url text;

COMMENT ON COLUMN tenants.ai_webhook_url IS
  'URL do webhook n8n do Neurocore associado ao tenant. Chamada diretamente pelo Go Gateway quando route_ai é acionado.';
