# Configurações Pendentes no N8N

Este documento descreve todas as configurações que precisam ser feitas nos workflows do N8N para que as features implementadas no frontend/backend funcionem de ponta a ponta — incluindo o envio real pelo WhatsApp.

---

## 1. Reply to Message (Responder Mensagem)

### Por que fazer
O frontend já envia os dados da mensagem citada no payload do webhook de envio. Sem essa configuração, a mensagem é enviada normalmente sem o contexto de resposta — o destinatário não verá a mensagem sendo respondida no WhatsApp.

### Webhook afetado
`N8N_SEND_MESSAGE_WEBHOOK`

### Novos campos no payload recebido pelo N8N

| Campo | Tipo | Descrição |
|---|---|---|
| `quotedExternalId` | `string \| null` | ID da mensagem no WhatsApp que está sendo respondida |
| `quotedContent` | `string` | Texto original da mensagem citada |
| `quotedFromMe` | `boolean` | `true` se a mensagem citada foi enviada pelo atendente/IA |

> Esses campos só estarão presentes quando a mensagem for uma resposta. Quando ausentes, o envio deve continuar normalmente.

### Como configurar — Evolution API

No nó de envio para a Evolution API, adicionar condição: se `quotedExternalId` estiver presente, incluir o objeto `quoted` no body:

```json
{
  "number": "{{ $json.contactPhone }}",
  "text": "{{ $json.content }}",
  "quoted": {
    "key": {
      "id": "{{ $json.quotedExternalId }}",
      "fromMe": {{ $json.quotedFromMe }},
      "remoteJid": "{{ $json.contactPhone }}@s.whatsapp.net"
    },
    "message": {
      "conversation": "{{ $json.quotedContent }}"
    }
  }
}
```

Se `quotedExternalId` for `null` ou ausente, enviar sem o campo `quoted`.

### Como configurar — WhatsApp Cloud API (Meta Oficial)

No nó de envio para a Cloud API, adicionar condição: se `quotedExternalId` estiver presente, incluir o objeto `context`:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{{ $json.contactPhone }}",
  "context": {
    "message_id": "{{ $json.quotedExternalId }}"
  },
  "type": "text",
  "text": {
    "body": "{{ $json.content }}"
  }
}
```

A Cloud API não precisa de `quotedContent` nem `quotedFromMe` — ela busca o conteúdo automaticamente pelo `message_id`.

### Lógica de roteamento sugerida no N8N

```
Recebe webhook
    │
    ├─ tem quotedExternalId?
    │       ├─ SIM → enviar com contexto de reply
    │       └─ NÃO → enviar normalmente
    │
    └─ qual provider? (Evolution ou Cloud API)
            ├─ Evolution → usar campo "quoted"
            └─ Cloud API → usar campo "context"
```

---

## 2. Follow Up Automático

### Por que fazer
A tabela `conversation_followups` armazena os follow-ups agendados. Sem um worker no N8N, os follow-ups ficam no banco mas nunca são enviados. O N8N precisa verificar periodicamente quais follow-ups estão no prazo e disparar as mensagens.

### Estratégia recomendada: Schedule Trigger

Criar um workflow com **Schedule Trigger** rodando a cada **5 minutos** que:

1. Busca follow-ups pendentes via Supabase REST API
2. Para cada um, executa a lógica de envio
3. Marca como concluído

### Passo a passo do workflow

**Nó 1 — Schedule Trigger**
- Intervalo: a cada 5 minutos

---

**Nó 2 — HTTP Request: buscar follow-ups pendentes**

Usar o nó **HTTP Request** (ou nó Supabase) para chamar a REST API do Supabase:

- **Method:** `GET`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/conversation_followups`
- **Query params:**
  ```
  is_done=eq.false
  scheduled_at=lte.{{ new Date().toISOString() }}
  select=*,conversation:conversations(contact_id,channel_id,status,contacts(phone))
  ```
- **Headers:**
  ```
  apikey: {{ $env.SUPABASE_SERVICE_KEY }}
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_KEY }}
  ```

Retorna array com os follow-ups no prazo, já com dados da conversa e do contato via join.

---

**Nó 3 — Split In Batches (loop por cada follow-up)**

---

**Nó 4 — IF: verificar `cancel_on_reply`**

Se `{{ $json.cancel_on_reply }}` for `true`, checar se o cliente respondeu depois que o follow-up foi criado:

- **Method:** `GET`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/messages`
- **Query params:**
  ```
  conversation_id=eq.{{ $json.conversation_id }}
  sender_type=eq.customer
  created_at=gt.{{ $json.created_at }}
  limit=1
  select=id
  ```

- Se retornar 1 ou mais registros → **cancelar** (ir para Nó 8 marcando `is_done=true`)
- Se retornar vazio → continuar

---

**Nó 5 — IF: verificar status da conversa**

Usar o campo `conversation.status` já retornado no Nó 2.

- Se `closed` → **cancelar** (ir para Nó 8 marcando `is_done=true`)
- Se `open` → continuar

---

**Nó 6 — IF: `ai_generate`**

Se `{{ $json.ai_generate }}` for `true`, chamar o webhook da IA com o contexto da conversa para gerar a mensagem de follow-up:

```json
{
  "conversationId": "{{ $json.conversation_id }}",
  "tenantId": "{{ $json.tenant_id }}",
  "instruction": "Gere uma mensagem de follow up para retomar o contato com o cliente, com base no contexto da conversa."
}
```

Se `ai_generate = false`, usar `{{ $json.message }}` diretamente.

---

**Nó 7 — Enviar mensagem**

Usar o mesmo fluxo de envio existente (Evolution ou Cloud API conforme o canal), com a mensagem gerada ou manual.

Após enviar, registrar a mensagem na tabela `messages` via REST API:

- **Method:** `POST`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/messages`
- **Body:**
  ```json
  {
    "conversation_id": "{{ $json.conversation_id }}",
    "content": "{{ $json.mensagemEnviada }}",
    "sender_type": "attendant",
    "status": "sent",
    "timestamp": "{{ new Date().toISOString() }}"
  }
  ```

---

**Nó 8 — HTTP Request: marcar follow-up como concluído**

- **Method:** `PATCH`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/conversation_followups?id=eq.{{ $json.id }}`
- **Headers:**
  ```
  apikey: {{ $env.SUPABASE_SERVICE_KEY }}
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_KEY }}
  Prefer: return=minimal
  ```
- **Body:**
  ```json
  {
    "is_done": true,
    "done_at": "{{ new Date().toISOString() }}"
  }
  ```

---

### Diagrama do fluxo

```
Schedule (5min)
    │
    ▼
GET /rest/v1/conversation_followups
  ?is_done=eq.false&scheduled_at=lte.NOW
    │
    ▼
Para cada follow-up:
    │
    ├─ cancel_on_reply = true?
    │       └─ GET /messages com sender_type=customer após created_at
    │               ├─ tem resposta → PATCH is_done=true → próximo
    │               └─ sem resposta → continuar
    │
    ├─ conversa.status = 'closed'?
    │       ├─ SIM → PATCH is_done=true → próximo
    │       └─ NÃO → continuar
    │
    ├─ ai_generate = true?
    │       ├─ SIM → chamar webhook IA → obter mensagem
    │       └─ NÃO → usar campo "message" do registro
    │
    ▼
Enviar via Evolution / Cloud API
    │
    ▼
POST /rest/v1/messages (registrar mensagem enviada)
    │
    ▼
PATCH /rest/v1/conversation_followups
  SET is_done=true, done_at=now()
```

---

---

## 3. Módulo de Agendamentos

### Por que fazer
O módulo de agendamentos usa o N8N para: (a) expirar holds automaticamente via cron, (b) disparar automações de confirmação/cancelamento/reagendamento via WhatsApp, e (c) suportar sweeps de confirmação e reengajamento pós no-show.

### Variáveis de ambiente necessárias

Adicionar no `.env.local` e na Vercel:

```bash
# Secret para autenticar chamadas do N8N ao endpoint de cron
SCHEDULING_CRON_SECRET=algum-secret-forte-aqui

# Webhooks N8N (opcional — há fallback para os paths padrão abaixo)
WEBHOOK_N8N_SCHEDULING_AUTOMATIONS=https://seu-n8n.com/webhook/livia/scheduling-automations
WEBHOOK_N8N_SCHEDULING_EXPIRE_HOLDS=https://seu-n8n.com/webhook/livia/scheduling-expire-holds
WEBHOOK_N8N_SCHEDULING_CONFIRMATION_SWEEP=https://seu-n8n.com/webhook/livia/scheduling-confirmation-sweep
WEBHOOK_N8N_SCHEDULING_REENGAGE=https://seu-n8n.com/webhook/livia/scheduling-reengage
```

---

### Workflow 1 — Cron: Expirar Holds (a cada 5 min)

Holds são reservas temporárias criadas pela IA ou pelo formulário manual. Se não confirmados dentro do `hold_duration_minutes` configurado pelo tenant, devem ser liberados automaticamente.

**Nó 1 — Schedule Trigger**
- Intervalo: a cada 5 minutos

**Nó 2 — HTTP Request: chamar endpoint expire-holds**

- **Method:** `POST`
- **URL:** `https://sua-app.com/api/agendamentos/expire-holds`
- **Headers:**
  ```
  x-cron-secret: {{ $env.SCHEDULING_CRON_SECRET }}
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {}
  ```

Resposta esperada: `{ "success": true, "data": { "expired_count": N } }`

> O endpoint usa a RPC `sched_expire_holds` no Supabase, que libera as alocações de recursos dos holds vencidos.

---

### Workflow 2 — Webhook: Automações de Agendamento

Disparado pelo backend sempre que um agendamento é **confirmado**, **cancelado**, **reagendado**, **concluído** ou marcado como **no-show**.

**Trigger:** Webhook `POST /webhook/livia/scheduling-automations`

**Payload recebido:**

```json
{
  "event": "scheduling.appointment.confirmed",
  "tenant_id": "uuid",
  "appointment_id": "uuid",
  "contact": {
    "id": "uuid",
    "name": "João Silva",
    "phone": "+5585999999999"
  },
  "appointment": {
    "start_at": "2026-04-01T10:00:00Z",
    "end_at": "2026-04-01T11:00:00Z",
    "unit_id": "uuid | null",
    "services": [{ "service_id": "uuid", "name": "Consulta" }],
    "resources": [{ "resource_id": "uuid", "name": "Dr. Silva", "type": "staff" }]
  },
  "automation_config": {
    "confirmation_message_template": "Seu agendamento foi confirmado para {{data}} às {{hora}}.",
    "reminder_hours_before": 24,
    "cancellation_notify_contact": true,
    "auto_confirm_holds": false
  }
}
```

**Eventos e ações sugeridas:**

| Evento | Ação no N8N |
|---|---|
| `scheduling.appointment.confirmed` | Enviar mensagem de confirmação ao contato via WhatsApp |
| `scheduling.appointment.canceled` | Enviar aviso de cancelamento (se `cancellation_notify_contact = true`) |
| `scheduling.appointment.rescheduled` | Enviar novo horário confirmado |
| `scheduling.appointment.completed` | Opcional: pedir avaliação/feedback |
| `scheduling.appointment.no_show` | Opcional: disparar reengajamento após X horas |

**Lógica de roteamento sugerida:**

```
Recebe webhook
    │
    ├─ event = confirmed  → enviar mensagem de confirmação
    ├─ event = canceled   → cancellation_notify_contact = true? → enviar aviso
    ├─ event = rescheduled → enviar novo horário
    ├─ event = completed  → (opcional) pedir feedback
    └─ event = no_show    → (opcional) acionar workflow de reengajamento
```

**Exemplo de mensagem de confirmação (Evolution API):**

```json
{
  "number": "{{ $json.contact.phone }}",
  "text": "Olá {{ $json.contact.name }}, seu agendamento de *{{ $json.appointment.services[0].name }}* foi confirmado para *{{ formatDate($json.appointment.start_at, 'DD/MM/YYYY') }}* às *{{ formatDate($json.appointment.start_at, 'HH:mm') }}*. Até lá!"
}
```

---

### Workflow 3 — Cron: Lembretes de Agendamento *(opcional)*

Envia lembretes X horas antes do agendamento, conforme `reminder_hours_before` do `automation_config`.

**Nó 1 — Schedule Trigger**
- Intervalo: a cada 30 minutos (ou 1 hora)

**Nó 2 — HTTP Request: buscar agendamentos que vencem em breve**

- **Method:** `GET`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/sched_appointments`
- **Query params:**
  ```
  status=eq.confirmed
  start_at=gte.{{ now }}
  start_at=lte.{{ now + reminder_hours }}
  select=*,contact:contacts(id,name,phone)
  ```
- **Headers:**
  ```
  apikey: {{ $env.SUPABASE_SERVICE_KEY }}
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_KEY }}
  ```

**Nó 3 — Para cada agendamento:** enviar lembrete via WhatsApp e registrar que o lembrete foi enviado (campo `reminder_sent_at` — adicionar à tabela se necessário).

---

### Workflow 4 — Webhook: Reengajamento Pós No-Show *(opcional)*

**Trigger:** Webhook `POST /webhook/livia/scheduling-reengage`

**Payload recebido:**

```json
{
  "tenant_id": "uuid",
  "appointment_id": "uuid",
  "contact_id": "uuid"
}
```

**Ação:** Após X horas do no-show, enviar mensagem tentando remarcar o contato.

---

## Resumo de prioridade

| # | Configuração | Impacto | Prioridade |
|---|---|---|---|
| 1 | Reply to Message — Evolution API | Reply aparece no WhatsApp do cliente | Alta |
| 2 | Reply to Message — Cloud API | Reply aparece no WhatsApp do cliente | Alta |
| 3 | Follow Up — Schedule Trigger + envio | Follow-ups nunca disparam sem isso | Alta |
| 4 | Follow Up — geração via IA | Necessário para `ai_generate=true` | Média |
| 5 | Agendamentos — Cron expire-holds | Holds ficam presos sem isso | Alta |
| 6 | Agendamentos — Webhook automations (confirmed/canceled) | Cliente não recebe confirmação | Alta |
| 7 | Agendamentos — Cron lembretes | Lembretes nunca são enviados | Média |
| 8 | Agendamentos — Webhook reengajamento no-show | Contatos não são abordados após falta | Baixa |
