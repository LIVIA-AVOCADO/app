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
A tabela `conversation_followups` armazena os follow-ups agendados. Sem um worker no N8N, os follow-ups ficam na tabela mas nunca são enviados. O N8N precisa verificar periodicamente quais follow-ups estão no prazo e disparar as mensagens.

### Novo webhook necessário
Sugestão de variável de ambiente: `N8N_FOLLOWUP_PROCESS_WEBHOOK`

Ou, alternativamente, usar um **trigger de Schedule** no próprio N8N (sem webhook externo).

### Estratégia recomendada: Schedule Trigger

Criar um workflow com **Schedule Trigger** rodando a cada **5 minutos** que:

1. Busca follow-ups pendentes via Supabase
2. Para cada um, executa a lógica de envio
3. Marca como concluído

### Passo a passo do workflow

**Nó 1 — Schedule Trigger**
- Intervalo: a cada 5 minutos

**Nó 2 — Supabase: buscar follow-ups pendentes**
```sql
SELECT
  f.*,
  c.contact_id,
  c.channel_id,
  c.status AS conversation_status,
  co.phone AS contact_phone
FROM conversation_followups f
JOIN conversations c ON c.id = f.conversation_id
JOIN contacts co ON co.id = c.contact_id
WHERE f.is_done = false
  AND f.scheduled_at <= now()
```

**Nó 3 — Loop por cada follow-up**

Para cada follow-up, executar:

**Nó 4 — Verificar `cancel_on_reply`**

Se `cancel_on_reply = true`, verificar se o cliente respondeu após a criação do follow-up:

```sql
SELECT COUNT(*) as replies
FROM messages
WHERE conversation_id = '{{ $json.conversation_id }}'
  AND sender_type = 'customer'
  AND created_at > '{{ $json.created_at }}'
```

- Se `replies > 0` → **cancelar** (marcar `is_done = true`, não enviar)
- Se `replies = 0` → **continuar**

**Nó 5 — Verificar `conversation_status`**

- Se `conversation_status = 'closed'` → **cancelar** (não faz sentido enviar para conversa encerrada)

**Nó 6 — Gerar mensagem (se `ai_generate = true`)**

Se `ai_generate = true`, chamar o webhook da IA com o contexto da conversa para gerar a mensagem de follow-up:

Payload para a IA:
```json
{
  "conversationId": "{{ $json.conversation_id }}",
  "tenantId": "{{ $json.tenant_id }}",
  "instruction": "Gere uma mensagem de follow up para retomar o contato com o cliente, com base no contexto da conversa."
}
```

Se `ai_generate = false`, usar o campo `message` diretamente.

**Nó 7 — Enviar mensagem**

Usar o mesmo fluxo de envio existente (Evolution ou Cloud API conforme o canal), com a mensagem gerada ou manual.

**Nó 8 — Marcar follow-up como concluído**

```sql
UPDATE conversation_followups
SET is_done = true, done_at = now()
WHERE id = '{{ $json.followup_id }}'
```

Também salvar a mensagem enviada na tabela `messages` com `sender_type = 'attendant'` (ou `'ai'` se foi gerada pela IA).

### Diagrama do fluxo

```
Schedule (5min)
    │
    ▼
Busca follow-ups com scheduled_at <= now() AND is_done = false
    │
    ▼
Para cada follow-up:
    │
    ├─ cancel_on_reply = true?
    │       └─ cliente respondeu depois de created_at?
    │               ├─ SIM → marcar is_done=true (cancelado) → próximo
    │               └─ NÃO → continuar
    │
    ├─ conversa está fechada?
    │       ├─ SIM → marcar is_done=true (cancelado) → próximo
    │       └─ NÃO → continuar
    │
    ├─ ai_generate = true?
    │       ├─ SIM → chamar IA → obter mensagem gerada
    │       └─ NÃO → usar campo "message" da tabela
    │
    ▼
Enviar mensagem via Evolution/Cloud API
    │
    ▼
INSERT em messages (registrar mensagem enviada)
    │
    ▼
UPDATE conversation_followups SET is_done=true, done_at=now()
```

---

## Variáveis de ambiente a adicionar

| Variável | Descrição |
|---|---|
| `N8N_FOLLOWUP_PROCESS_WEBHOOK` | Webhook para processar follow-ups (opcional se usar Schedule Trigger interno) |

---

## Resumo de prioridade

| # | Configuração | Impacto | Prioridade |
|---|---|---|---|
| 1 | Reply to Message — Evolution API | Reply aparece no WhatsApp do cliente | Alta |
| 2 | Reply to Message — Cloud API | Reply aparece no WhatsApp do cliente | Alta |
| 3 | Follow Up — Schedule Trigger + envio | Follow-ups nunca disparam sem isso | Alta |
| 4 | Follow Up — geração via IA | Necessário para `ai_generate=true` | Média |
