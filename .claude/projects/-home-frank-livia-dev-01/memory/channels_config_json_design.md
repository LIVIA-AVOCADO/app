---
name: Channels config_json design
description: Decisão de arquitetura — dados provider-specific ficam em config_json, colunas universais ficam como colunas
type: project
---

Decisão: `channels` table mantém colunas universais; dados que variam por provider vão para `config_json` (JSONB).

**Why:** n8n lê diretamente do config_json. Ter provider_external_channel_id como coluna seria dado duplicado. Nova arquitetura permite adicionar providers sem migrations de schema.

**Colunas universais (ficam):**
id, tenant_id, channel_provider_id, name, identification_number, connection_status,
is_active, is_receiving_messages, is_sending_messages, message_wait_time_fragments,
observations, created_at, updated_at

**Colunas dropadas (migradas para config_json):**
- provider_external_channel_id → config_json.instance_name (Evolution) / config_json.phone_number_id (Meta)
- external_api_url → config_json.webhook_url
- instance_company_name → config_json.verified_name (Meta) / config_json.company_name (Evolution)
- identification_channel_client_descriptions → config_json.client_description

**config_json por provider:**
```
Evolution: { instance_name, instance_id, instance_id_api, apikey_instance, webhook_url, evolution_api_url, client_description, settings:{...} }
Meta:      { phone_number_id, access_token, verified_name, webhook_url }
```

**Indexes de lookup (expression indexes no JSONB):**
- `channels_evolution_instance_idx` ON `(config_json->>'instance_name')`
- `channels_meta_phone_number_id_idx` ON `(config_json->>'phone_number_id')`

**How to apply:** Toda query que antes usava `WHERE provider_external_channel_id = X` agora usa `WHERE config_json->>'instance_name' = X` (Evolution) ou `WHERE config_json->>'phone_number_id' = X` (Meta). Nunca esquecer dos expression indexes para performance no webhook handler (hot path).
