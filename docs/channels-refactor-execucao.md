# Channels & Evolution API — Execução do Refactor

**Data:** 2026-03-31
**Status:** Concluído
**Commits:** `f04911a` → `b3af553`
**Plano de referência:** `docs/channels-refactor-plan.md`

---

## O que foi feito

### 1. `lib/evolution/utils.ts` (novo arquivo)

Criado com tipos e helper compartilhados:

```typescript
export type EvolutionConnectionState = 'open' | 'close' | 'connecting' | 'refused';
export type ChannelConnectionStatus  = 'connected' | 'connecting' | 'disconnected';
export function mapConnectionState(state: string): ChannelConnectionStatus
```

---

### 2. `lib/evolution/client.ts` — 4 bugs corrigidos

| Bug | Problema | Correção |
|---|---|---|
| #1 | `connectInstance` tipava retorno como `{ base64 }` mas Evolution v2.3.6 retorna `{ code }` | Importa `qrcode`, converte `code` → SVG → base64 via `codeToDataUrl()` |
| #2 | `restartInstance` usava `POST` | Alterado para `PUT` |
| #5 | `EvolutionConnectionState` não incluía `'refused'` | Adicionado ao union type (movido para `utils.ts`) |
| #6 | Webhook configurado sem `QRCODE_UPDATED` | Adicionado ao array de eventos |

Bug #3 (onboarding/qrcode bypassa client) e Bug #4 (mapState duplicado) corrigidos nas etapas 4 e 2 respectivamente.

---

### 3. Migration SQL — consolidação de colunas em `config_json`

**Arquivo:** `supabase/migrations/20260331_channels_config_json_consolidation.sql`

| Fase | Ação |
|---|---|
| 1 | UPDATE Evolution channels: `provider_external_channel_id` → `config_json.instance_name`, `instance_company_name` → `config_json.company_name`, adiciona `config_json.webhook_url` |
| 2 | UPDATE Meta channels: `provider_external_channel_id` → `config_json.phone_number_id`, `instance_company_name` → `config_json.verified_name` |
| 3 | CREATE INDEX expression indexes em `config_json->>'instance_name'` e `config_json->>'phone_number_id'` |
| 4 | DROP COLUMN `provider_external_channel_id`, `instance_company_name`, `identification_channel_client_descriptions`, `external_api_url` |

---

### 4. Rotas Evolution (7 arquivos)

Todas passaram a ler `config_json->>'instance_name'` em vez de `provider_external_channel_id`.

| Arquivo | Mudança principal |
|---|---|
| `conexoes/create/route.ts` | Insert sem colunas legacy; `config_json` com `instance_name`, `instance_id`, `apikey_instance`, `webhook_url`, `settings`; lê apikey do response Evolution |
| `conexoes/status/route.ts` | Lê `config_json.instance_name`; usa `mapConnectionState` de utils |
| `conexoes/webhook/route.ts` | `.filter('config_json->>instance_name', 'eq', instanceName)`; usa `mapConnectionState` de utils |
| `conexoes/reconnect/route.ts` | Aceita `channelId` no body; lê `config_json.instance_name` |
| `conexoes/disconnect/route.ts` | Aceita `channelId` no body; lê `config_json.instance_name` |
| `conexoes/restart/route.ts` | Aceita `channelId` no body; lê `config_json.instance_name` |
| `conexoes/delete/route.ts` | Lê `config_json.instance_name` |

---

### 5. Rotas Meta (4 arquivos)

| Arquivo | Mudança principal |
|---|---|
| `meta/create/route.ts` | Insert sem colunas legacy; `config_json` com `phone_number_id`, `access_token`, `verified_name` |
| `meta/status/route.ts` | Lê `config_json.phone_number_id` e `config_json.verified_name`; update via merge em `config_json` |
| `meta/webhook/route.ts` | `.filter('config_json->>phone_number_id', 'eq', phoneNumberId)` |
| `meta/update-credentials/route.ts` | Update faz merge em `config_json` (não sobrescreve outras chaves) |

---

### 6. Onboarding Evolution (2 arquivos)

| Arquivo | Mudança |
|---|---|
| `onboarding/evolution/instance/route.ts` | Step payload salva `instance_name` (antes era `external_channel_id`) |
| `onboarding/evolution/qrcode/[instanceName]/route.ts` | Usa `connectInstance()` do client (Bug #3 corrigido) |

---

### 7. `conexoes/page.tsx`

- Removido filtro `.not('provider_external_channel_id', 'is', null)`
- `instanceName` lido de `config_json.instance_name ?? config_json.phone_number_id`

---

### 8. n8n — [AVOC] [DEV] FIRST INTEGRATOR - 002 DEV

**Workflow ID:** `ZYKLJxhdK0bijwQy`

Problema identificado: o nó `post - get channel evolution by instance id` passava `body.apikey` para a RPC, que buscava por `config_json->>'instance'` (chave legada com apikey). Canais novos (pós-refactor) não têm essa chave → lookup falhava.

#### Nós atualizados via API n8n

| Nó | Campo | Antes | Depois |
|---|---|---|---|
| `normalize_payload_evolution_001` | `provider_external_channel_id` | `body.apikey` | `body.instance` |
| `post - get channel evolution by instance id` | param body | `p_instance_id = body.apikey` | `p_instance_name = body.instance` |
| `build_master_integrator_payload` | validação `provider_external_channel_id` | `config_json.instance` | `config_json.instance_name` |

---

### 9. Migration SQL — RPC atualizada (v1)

**Arquivo:** `supabase/migrations/20260331_update_rpc_get_channel_evolution.sql`

Versão inicial — retornava apenas `SETOF public.channels` (sem dados do provider).

**Motivo do fallback:** canais antigos têm `config_json.instance` (apikey); canais novos têm `config_json.instance_name`. O OR garante que ambos funcionem.

### 9b. Migration SQL — RPC corrigida com JOIN em channel_providers (v2)

**Arquivo:** `supabase/migrations/20260331_fix_rpc_get_channel_evolution_join_provider.sql`

```sql
DROP FUNCTION IF EXISTS public.get_channel_evolution_by_instance_id(text);

CREATE OR REPLACE FUNCTION public.get_channel_evolution_by_instance_id(
  p_instance_name text
)
RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT to_jsonb(c.*) || jsonb_build_object(
    'channel_provider_identifier_code', cp.channel_provider_identifier_code,
    'id_subwork_n8n_master_integrator', cp.id_subwork_n8n_master_integrator
  )
  FROM public.channels c
  INNER JOIN public.channel_providers cp ON cp.id = c.channel_provider_id
  WHERE (
    c.config_json->>'instance_name' = p_instance_name
    OR c.config_json->>'instance'   = p_instance_name
  )
    AND c.is_active = true
  LIMIT 1;
$$;
```

**Problema na v1:** a RPC retornava `SETOF public.channels`, que NÃO contém
`id_subwork_n8n_master_integrator` nem `channel_provider_identifier_code` —
esses campos vivem em `channel_providers`. O n8n recebia esses campos como
empty/null, causando erro nos nós `call_master_integrator_workflow` e
`build_master_integrator_payload`.

**Correção:** JOIN com `channel_providers` via FK `channel_provider_id`, retorno
como `SETOF jsonb` para incluir todos os campos de `channels` + os dois campos
do provider no mesmo nível (flat).

---

## Estrutura `config_json` por provider (pós-refactor)

```json
// Evolution API
{
  "instance_name":     "livia-abc123",
  "instance_id":       "eba6ad03-...",
  "instance_id_api":   "DF95B747EA0F-...",   // legado — identificador na API Evolution
  "apikey_instance":   "ABC...",
  "webhook_url":       "https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev",
  "evolution_api_url": "https://wsapilocal2.ligeira.net",
  "settings": {
    "reject_call": true,
    "msg_call": "No momento só consigo falar por mensagens...",
    "groups_ignore": true,
    "always_online": false,
    "read_messages": false,
    "read_status": false,
    "sync_full_history": false
  }
}

// Meta Oficial WhatsApp
{
  "phone_number_id": "120364...",
  "access_token":    "EAAA...",
  "verified_name":   "Empresa X"
}
```

---

## Lookup de canal no hot path (webhook → n8n → Supabase)

```
Evolution webhook
  body.instance = "livia-abc123"   (instance_name)
       ↓
n8n: p_instance_name = body.instance
       ↓
RPC: WHERE config_json->>'instance_name' = p_instance_name
       ↓
Retorna channel com tenant_id, id_subwork_n8n_master_integrator, etc.
```

---

## Impacto zero em

- Componentes UI (`QrCodeDisplay`, `AddChannelDialog`, `WhatsappConnect`)
- Lógica de polling no frontend
- Rota de ativação do onboarding
- Meta webhook verification (GET hub challenge)

---

## Correções pós-refactor (2026-04-26)

### send-message/route.ts — `resolveChannelInfo`

Diagnóstico: `SELECT 'config_json, external_api_url, instance_company_name, provider_external_channel_id'`
falhava com `column does not exist` porque o refactor removeu essas colunas físicas.

**Fix:** selecionar apenas `config_json`. Todos os campos lidos diretamente do JSON:
- `cfg.evolution_api_url` → base URL da Evolution
- `cfg.instance_name` → nome da instância
- `cfg.instance_id_api` → API key da instância (campo real em produção)

> **Atenção:** o plano previa `apikey_instance` como chave da API no `config_json`.
> Em produção o campo é `instance_id_api` (gerado pelo onboarding).
> O código usa `cfg?.evolution_api_key ?? cfg?.instance_id_api` para cobrir ambos.

### Gateway Go — resolução de JID/LID (v1.1.6+)

Evolution v2.3.6 pode enviar `remoteJid=189369738637507@lid` (LID de dispositivo vinculado).
A Evolution API **não aceita LID** no `/message/sendText` — rejeita com 400.

**Fix em `gateway/normalizer.go`:**
- `data.key.remoteJidAlt` contém o JID `@s.whatsapp.net` correto
- `data.key.senderPn` (v2.3.0+) contém o número puro (mais confiável)
- `resolvePhone()` extrai o telefone real pela hierarquia: `senderPn` > `@s.whatsapp.net` JID > fallback stripped
- `ReplyJID` armazena sempre o número puro para envio

**Contatos duplicados (efeito colateral):** canais com LID criaram contatos com
`external_identification_contact=<LID>@s.whatsapp.net`. Após o fix, novos contatos são
criados com o telefone real. Limpeza pendente.

### Typing indicator — presence (2026-04-26) ✅

Gateway v1.2.0 + Next.js (commit `e804bc8`).

**IA automático (URA Engine):**
`sendPresenceViaEvolution` chamado antes de cada mensagem da IA.
O contato vê "digitando..." por `typingDelay(msg)` ms antes de receber o texto. Non-fatal.

**Modo manual (agente):**
- `handlers/presence.go` — endpoint `POST /presence` no gateway
- `app/api/send-presence/route.ts` — resolve canal + contato e chama gateway fire-and-forget
- `lib/hooks/use-whatsapp-presence.ts` — throttle 4s (presence dura 5s no WhatsApp)
- `components/inbox/conversation-view.tsx` — `handleTyping` compõe `broadcastTyping` (Realtime UI) + `sendPresence` (WhatsApp)

Endpoint Evolution usado: `POST /chat/sendPresence/{instance}`
