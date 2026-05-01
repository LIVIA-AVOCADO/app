# Integração — Gateway (livia-avocado/gateway)

Como o app se comunica com o gateway Go.

O gateway é um serviço externo — roda na VPS, deploy independente, sem
compartilhar código ou pipeline com o Next.js.

---

## Envio de mensagem

```
POST {GATEWAY_URL}/v2/send
Authorization: Bearer {GATEWAY_API_KEY}
Content-Type: application/json
```

```json
{
  "channel_id":        "uuid-do-canal",
  "to":                "5511999999999",
  "text":              "Mensagem do operador",
  "quoted_external_id": "3EB0ABC123DEF456",
  "quoted_from_me":    false,
  "quoted_content":    "Texto citado"
}
```

`quoted_*` só são enviados quando o operador está respondendo a uma mensagem
específica. O gateway resolve o provider (Evolution ou Meta) a partir do
`channel_id`.

**Onde é chamado:** `app/api/n8n/send-message/route.ts` — dentro do `after()`
do Next.js, após a resposta HTTP já ter sido enviada ao browser.

**Resposta de sucesso:**
```json
{ "external_message_id": "3EB0DEF789GHI012" }
```

O `external_message_id` é salvo no banco e habilita quote de mensagens do
operador/IA pelo cliente.

---

## Typing indicator (presence)

```
POST {GATEWAY_URL}/presence
Authorization: Bearer {GATEWAY_API_KEY}
Content-Type: application/json
```

```json
{
  "evolutionBaseUrl": "https://host-evolution/",
  "evolutionApiKey":  "api-key-da-instancia",
  "instanceName":     "nome-da-instancia",
  "number":           "5511999999999",
  "presence":         "composing",
  "delay":            5000
}
```

**Onde é chamado:** `app/api/send-presence/route.ts` — fire-and-forget,
erro não bloqueia o cliente. Exclusivo para Evolution (Meta não suporta).

---

## Notificação via conversation_id

```
POST {GATEWAY_URL}/notify
Authorization: Bearer {GATEWAY_API_KEY}
Content-Type: application/json
```

```json
{
  "conversation_id": "uuid-da-conversa",
  "message":         "Texto da notificação"
}
```

Permite enviar mensagem sem conhecer credenciais do canal — o gateway
resolve internamente. Usado por workflows n8n.

---

## Variáveis de ambiente

| Var | Descrição |
|---|---|
| `GATEWAY_URL` | URL base sem path (ex: `https://livia-gw.online24por7.ai`) |
| `GATEWAY_API_KEY` | Chave Bearer para todos os endpoints outbound |
