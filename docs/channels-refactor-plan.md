# Channels & Evolution API — Plano de Refatoração

**Data:** 2026-03-31
**Status:** Aprovado — aguardando execução

---

## Contexto

A tabela `channels` e a integração com a Evolution API v2.3.6 apresentam dois tipos de problema:

1. **Bugs funcionais** — QR code nunca aparece, restart usa método HTTP errado
2. **Design** — colunas provider-specific na tabela, lógica duplicada no código

---

## Decisões de arquitetura

### 1. `channels` — colunas universais vs config_json

**Regra:** apenas dados que variam por provider vão para `config_json`. Dados universais (presentes e com mesmo significado em qualquer provider) ficam como colunas.

**Motivação:** n8n lê diretamente do `config_json`. Ter `provider_external_channel_id` como coluna separada seria dado duplicado. A nova arquitetura permite adicionar futuros providers (Twilio, Instagram, Telegram) sem migrations de schema.

#### Colunas que ficam (universais)

| Coluna | Motivo |
|---|---|
| `id`, `tenant_id`, `channel_provider_id`, `name` | identidade |
| `identification_number` | número/handle visível na UI (universal) |
| `connection_status` | estado de conexão (universal) |
| `is_active`, `is_receiving_messages`, `is_sending_messages` | comportamento |
| `message_wait_time_fragments`, `observations` | configuração universal |
| `created_at`, `updated_at` | auditoria |

#### Colunas removidas → migradas para `config_json`

| Coluna removida | Provider | Chave no config_json |
|---|---|---|
| `provider_external_channel_id` | Evolution | `config_json.instance_name` |
| `provider_external_channel_id` | Meta | `config_json.phone_number_id` |
| `instance_company_name` | Evolution | `config_json.company_name` |
| `instance_company_name` | Meta | `config_json.verified_name` |
| `identification_channel_client_descriptions` | Evolution | `config_json.client_description` |
| `external_api_url` | todos | `config_json.webhook_url` |

#### Estrutura config_json por provider

```json
// Evolution API (evolution_001)
{
  "instance_name":      "livia-abc123",
  "apikey_instance":    "ABC...",
  "webhook_url":        "https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev",
  "company_name":       "Empresa X",
  "client_description": "Canal principal",
  "settings": {
    "reject_call":       true,
    "msg_call":          "No momento só consigo falar por mensagens...",
    "groups_ignore":     true,
    "always_online":     false,
    "read_messages":     false,
    "read_status":       false,
    "sync_full_history": false
  }
}

// Meta Oficial WhatsApp (meta_oficial_whatsapp)
{
  "phone_number_id": "120364...",
  "access_token":    "EAAA...",
  "verified_name":   "Empresa X",
  "webhook_url":     "https://..."
}
```

#### Performance — expression indexes

Como `provider_external_channel_id` vai para o JSON, o webhook handler (hot path — chamado a cada mensagem) precisa de indexes dedicados:

```sql
CREATE INDEX channels_evolution_instance_idx
  ON public.channels ((config_json->>'instance_name'));

CREATE INDEX channels_meta_phone_number_id_idx
  ON public.channels ((config_json->>'phone_number_id'));
```

Performance equivalente a índice em coluna regular.

---

### 2. Webhook Evolution → n8n

**URL configurada em todas as instâncias:**
```
https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev
```

Lida via `process.env.EVOLUTION_INSTANCE_WEBHOOK_URL`. Nunca hardcodar.

**Arquitetura de eventos:**
- Evolution envia todos os eventos para o n8n (first integrator)
- n8n roteia internamente: `MESSAGES_UPSERT` → workflows de atendimento, `CONNECTION_UPDATE` → encaminha para LIVIA se necessário
- `byEvents: true` → cada evento vai para sub-path: `.../connection-update`, `.../messages-upsert`, `.../qrcode-updated`

**Eventos configurados por instância:**
```
MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED
```

A URL do webhook é salva em `config_json.webhook_url` no momento da criação do canal.

---

## Bugs identificados

### Bug #1 — QR code nunca aparece (crítico)

**Causa:** `connectInstance()` em `lib/evolution/client.ts` tipava o retorno como `{ base64, pairingCode }`, mas a Evolution API v2.3.6 retorna `{ code, pairingCode, count }`. O campo `base64` não existe no response HTTP — ele só aparece no evento webhook `QRCODE_UPDATED`.

**Impacto:** Toda a tela de conexão WhatsApp (onboarding e pós-onboarding) não exibe QR code. O campo `base64` chegava sempre `undefined`.

**Solução:** Instalar pacote `qrcode`. Quando a Evolution retorna `code` (string raw do QR), converter para `data:image/svg+xml;base64,...` via `qrcode.toString(code, { type: 'svg' })`. O frontend continua recebendo uma data URL e renderizando via `<img>` — sem mudanças nos componentes.

```
Evolution retorna → { code: "2@xxx...", pairingCode: "ABCD-1234" }
client.ts converte → { base64: "data:image/svg+xml;base64,...", pairingCode: "ABCD-1234" }
frontend exibe    → <img src="data:image/svg+xml;base64,..." />
```

### Bug #2 — Restart usa método HTTP errado

**Causa:** `restartInstance()` usa `POST /instance/restart/{name}`. A Evolution API v2.3.6 exige `PUT`.

**Impacto:** Restart silenciosamente falha (4xx ignorado pelo código atual).

**Solução:** Alterar para `PUT`.

### Bug #3 — Rota `onboarding/evolution/qrcode` bypassa o client

**Causa:** A rota faz `fetch` direto para a Evolution sem passar por `lib/evolution/client.ts`, duplicando lógica e não se beneficiando das correções do client.

**Solução:** Usar `connectInstance()` do client.

### Bug #4 — `mapState` duplicado

**Causa:** A função `mapState` (mapeia estado Evolution → status interno) está copiada em `conexoes/status/route.ts` e `conexoes/webhook/route.ts`.

**Solução:** Extrair para `lib/evolution/utils.ts`.

### Bug #5 — `EvolutionConnectionState` incompleto

**Causa:** O tipo não inclui `'refused'` (estado retornado quando o limite de QR é atingido).

**Solução:** Adicionar ao union type.

### Bug #6 — `QRCODE_UPDATED` ausente nos eventos do webhook

**Causa:** Webhook configurado apenas com `MESSAGES_UPSERT` e `CONNECTION_UPDATE`.

**Solução:** Adicionar `QRCODE_UPDATED` para que o n8n receba e possa reagir a novos QR codes.

---

## Plano de execução

### Etapa 1 — Migration SQL

Arquivo: `supabase/migrations/20260331_channels_config_json_consolidation.sql`

```
FASE 1: UPDATE Evolution channels → migra dados para config_json
FASE 2: UPDATE Meta channels → migra dados para config_json
FASE 3: CREATE INDEX expression indexes (instance_name, phone_number_id)
FASE 4: ALTER TABLE DROP COLUMN (4 colunas)
```

**Ordem importa:** dados migrados ANTES do DROP para evitar perda.

### Etapa 2 — `lib/evolution/utils.ts` (novo)

Conteúdo:
- Tipo `EvolutionConnectionState` (com `refused`)
- Tipo `ChannelConnectionStatus`
- Função `mapConnectionState(state): ChannelConnectionStatus`

### Etapa 3 — `lib/evolution/client.ts` (refatorar)

Mudanças:
- Importar `qrcode` e adicionar helper `codeToDataUrl(code: string)`
- `connectInstance`: mapear `code` → `base64` via qrcode
- `restartInstance`: `POST` → `PUT`
- `configureInstanceWebhook`: adicionar `QRCODE_UPDATED` aos eventos
- Salvar `apikey_instance` e `settings` retornados pelo Evolution no response
- Remover tipos inline duplicados (usar `utils.ts`)

### Etapa 4 — Rotas Evolution (6 arquivos)

| Arquivo | Mudança principal |
|---|---|
| `conexoes/create/route.ts` | Insert sem `provider_external_channel_id`; config_json com `instance_name`, `apikey_instance`, `webhook_url`, `settings` |
| `conexoes/status/route.ts` | Query por `config_json->>'instance_name'`; usar `mapConnectionState` de utils |
| `conexoes/webhook/route.ts` | Query por `config_json->>'instance_name'`; usar `mapConnectionState` de utils |
| `conexoes/reconnect/route.ts` | Aceitar `channelId` no body; ler `config_json->>'instance_name'` |
| `conexoes/disconnect/route.ts` | Aceitar `channelId` no body; ler `config_json->>'instance_name'` |
| `conexoes/restart/route.ts` | Aceitar `channelId` no body; ler `config_json->>'instance_name'` |
| `conexoes/delete/route.ts` | Ler `config_json->>'instance_name'` |

### Etapa 5 — Rotas Meta (4 arquivos)

| Arquivo | Mudança principal |
|---|---|
| `meta/create/route.ts` | Insert sem `provider_external_channel_id`, sem `instance_company_name`; config_json com `phone_number_id`, `verified_name` |
| `meta/status/route.ts` | Ler `config_json.phone_number_id`, `config_json.verified_name`; update em config_json |
| `meta/webhook/route.ts` | Query por `config_json->>'phone_number_id'` |
| `meta/update-credentials/route.ts` | Update em `config_json` via merge (não sobrescrever) |

### Etapa 6 — Onboarding Evolution (2 arquivos)

| Arquivo | Mudança principal |
|---|---|
| `onboarding/evolution/instance/route.ts` | Salvar `instance_name` em vez de `external_channel_id` no step payload |
| `onboarding/evolution/qrcode/[instanceName]/route.ts` | Usar `connectInstance()` do client |

### Etapa 7 — UI (1 arquivo)

| Arquivo | Mudança principal |
|---|---|
| `conexoes/page.tsx` | Ler `config_json.instance_name` para `instanceName`; remover filtro `not('provider_external_channel_id', 'is', null)` |

---

## Impacto zero em

- Componentes de UI (QrCodeDisplay, AddChannelDialog, WhatsappConnect) — recebem os mesmos tipos
- Lógica de polling no frontend — sem mudanças
- Rota de ativação do onboarding — não usa essas colunas
- Meta webhook verification (GET hub challenge) — não usa essas colunas

---

## Dependências adicionadas

| Pacote | Versão | Uso |
|---|---|---|
| `qrcode` | ^1.5.4 | Converter `code` string → SVG base64 no server |
| `@types/qrcode` | dev | Tipos TypeScript |

Instalado em: `npm install qrcode && npm install -D @types/qrcode`

---

## Variáveis de ambiente relevantes

```bash
EVOLUTION_API_BASE_URL=https://wsapilocal2.ligeira.net
EVOLUTION_API_KEY=xTTX8udaV3w2EdsV41duwbART
EVOLUTION_INSTANCE_WEBHOOK_URL=https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev
EVOLUTION_WEBHOOK_SECRET=ad8a28b4...
```
