---
name: Evolution Webhook URL
description: URL do webhook n8n configurada em todas as instâncias Evolution
type: project
---

URL do first integrator n8n que deve ser registrada em cada instância Evolution:
`https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev`

**Why:** n8n atua como roteador de todos os eventos Evolution (MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED). Está em `EVOLUTION_INSTANCE_WEBHOOK_URL` no .env.local e Vercel.

**How to apply:** Sempre usar `process.env.EVOLUTION_INSTANCE_WEBHOOK_URL` — nunca hardcodar. Salvar também em `config_json.webhook_url` do canal ao criar instância.
