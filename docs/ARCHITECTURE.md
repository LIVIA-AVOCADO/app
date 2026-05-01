# Arquitetura — LIVIA App

Next.js 15 (App Router) — frontend + API Routes da plataforma LIVIA.
O app é a camada de produto: UI para atendentes, configuração de canais e agentes,
e orquestração das chamadas para os serviços externos.

Serviços externos: **Supabase** (banco + realtime + storage), **gateway Go**
(mensagens WhatsApp), **Evolution API** (gerenciamento de instâncias),
**n8n** (IA/Neurocore, automações), **Stripe** e **MercadoPago** (billing).

---

## Estrutura de rotas

```
app/
  (auth)/          — login, signup, onboarding, aguardando-acesso
  (dashboard)/     — todas as páginas autenticadas
  api/             — API Routes chamadas pelo frontend e por webhooks externos
```

Páginas do dashboard usam Server Components para carregamento inicial (SSR) e
Client Components para interatividade e realtime.

---

## Bloco 1 — Mensagens e canais

### Inbox (Livechat)

**Carregamento inicial (SSR):**
- Servidor busca conversas ativas, tags e contadores em paralelo via Supabase
- Mensagens da conversa selecionada carregadas no SSR; demais carregadas sob demanda

**Realtime:**
- `useRealtimeMessages` — Supabase Realtime (WebSocket) na tabela `messages`
  da conversa aberta; retry exponencial com até 10 tentativas
- `useRealtimeConversations` — Supabase Realtime na lista de conversas

**Envio de mensagem pelo operador:**

```
Operador envia
  → POST /api/n8n/send-message
    → Supabase: insere mensagem (status=sent)
    → Resposta imediata ao browser (< 30ms)
    → after(): gateway POST /v2/send        ← fora do response cycle (Vercel after())
               n8n POST N8N_PAUSE_IA_WEBHOOK ← pausa IA se estava ativa
```

O `after()` do Next.js garante execução completa no Vercel mesmo após a resposta
HTTP ser enviada. Se o gateway demorar mais de 30s, mensagem permanece `sent`
(sem `external_message_id`); quote dessa mensagem não funcionará.

**Fluxo inbound (cliente envia para o atendente):**

```
WhatsApp → Evolution/Meta → gateway → Supabase (messages)
                                             ↓
                              Supabase Realtime → useRealtimeMessages → UI
```

O app não recebe webhooks de mensagens inbound — lê via Realtime do Supabase.

---

### Conexões / Canais

O app gerencia o ciclo de vida das instâncias Evolution diretamente via
`lib/evolution/client.ts`. O gateway não participa desse fluxo.

**Criar canal Evolution:**
```
POST /api/configuracoes/conexoes/create
  → Evolution API: cria instância + configura webhook + configura settings
  → Supabase: insere canal (config_json com credentials)
  → Retorna QR code para conexão imediata
```

**Webhook de status de conexão:**
```
Evolution → POST /api/configuracoes/conexoes/webhook  (validado por EVOLUTION_WEBHOOK_SECRET)
  → Supabase: atualiza channels.connection_status
              insere em channel_connection_logs
```

Mapeamento de estados Evolution → LIVIA:
`open` → `connected` | `close` → `disconnected` | `connecting` → `connecting` | `refused` → `disconnected`

**Criar canal Meta:**
```
POST /api/configuracoes/conexoes/meta/create
  → Supabase: insere canal com phone_number_id + access_token
  → Gateway registra /webhook/meta automaticamente (via META_APP_SECRET)
```

**Separação de responsabilidades — Evolution:**

| Quem | Responsabilidade |
|---|---|
| App (`lib/evolution/client.ts`) | Criar, conectar, configurar, reiniciar, desconectar instâncias |
| Gateway | Receber webhooks de mensagens, persistir, enviar respostas |

O app nunca envia mensagens diretamente para a Evolution em produção —
todo envio passa pelo gateway (`GATEWAY_URL/v2/send`).
