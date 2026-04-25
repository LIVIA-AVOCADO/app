-- Move ai_webhook_url de tenants para neurocores.
-- Cada neurocore tem seu próprio webhook — tenants herdam ao associar o neurocore.

ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS ai_webhook_url;

ALTER TABLE public.neurocores
  ADD COLUMN IF NOT EXISTS webhook_url text;

COMMENT ON COLUMN public.neurocores.webhook_url IS
  'URL do webhook n8n chamada pelo Go Gateway quando route_ai é acionado. Herdada por todos os tenants associados a este neurocore.';
