# Plano de Implementação — Silenciar Contato

**Data:** 2026-03-25
**Status:** Planejado — aguardando início do Sprint 1

---

## Objetivo

Permitir que atendentes silenciem contatos inconvenientes (bots, spam, clientes abusivos), fazendo com que as mensagens recebidas sejam descartadas automaticamente pelo n8n, sem consumir recursos de IA e sem bloquear o número na API do WhatsApp.

---

## Decisões de Design

| Aspecto | Decisão |
|---|---|
| Duração do mute | Permanente até desfazer manualmente |
| Comportamento n8n | Descartar silenciosamente (sem reply automático) |
| IA ao silenciar | Auto-pausada em todas as conversas abertas do contato |
| IA ao remover silêncio | NÃO reativada automaticamente — decisão explícita do atendente |
| Lista de conversas | Contato silenciado some da lista principal |
| Visualização | Aba "Silenciadas" no sidebar do livechat |
| Notificações | Ícone centralizado no header (Sprint 2) |

---

## Motivação

- Pseudo-bloqueio: evita bloquear o número na API oficial do WhatsApp (impacto negativo na conta)
- Proteção contra bots: silenciar imediatamente sem desperdiçar créditos de IA
- Controle do atendente: ação reversível a qualquer momento

---

## Arquitetura da Solução

### Onde fica o flag de mute

Campo na tabela `contacts` (não em `conversations`).

**Motivo:** o n8n identifica o contato pelo `phone` — a busca direta em `contacts` é natural e eficiente. Além disso, silenciar é uma decisão sobre a pessoa, não sobre a thread. Uma nova conversa do mesmo contato já nasce silenciada automaticamente.

---

## Sprint 1 — Core (sem notificações)

### 1. Banco de Dados

**Migration:** `supabase/migrations/YYYYMMDD_mute_contact.sql`

```sql
ALTER TABLE contacts
  ADD COLUMN is_muted  boolean     NOT NULL DEFAULT false,
  ADD COLUMN muted_at  timestamptz,
  ADD COLUMN muted_by  uuid        REFERENCES auth.users(id);

-- Index para o n8n consultar rapidamente por phone + tenant
CREATE INDEX idx_contacts_muted
  ON contacts (tenant_id, phone)
  WHERE is_muted = true;
```

---

### 2. API Routes (Next.js)

#### `POST /api/contacts/[id]/mute`

Payload: `{ action: "mute" | "unmute" }`

**Fluxo — mute:**
1. Auth + validação de tenant
2. Confirma que `contact.tenant_id === user.tenant_id`
3. `UPDATE contacts SET is_muted = true, muted_at = now(), muted_by = user.id WHERE id = :id`
4. `UPDATE conversations SET ia_active = false WHERE contact_id = :id AND status = 'open' AND ia_active = true`
5. Retorna `{ contact, affected_conversations_count }`

**Fluxo — unmute:**
1. Auth + validação de tenant
2. `UPDATE contacts SET is_muted = false, muted_at = null, muted_by = null WHERE id = :id`
3. IA **não** é reativada automaticamente
4. Retorna `{ contact }`

#### `GET /api/contacts/muted`

- Retorna todos os contatos silenciados do tenant
- Join com `users` para exibir nome de quem silenciou (`muted_by → users.name`)
- Usado na aba "Silenciadas"

---

### 3. N8n — Master Integrators (Evolution + Meta Oficial)

**Regra:** check deve ocorrer no **início** do workflow, antes de qualquer processamento (criação de conversa, chamada à IA, etc.).

**Lógica a adicionar em ambos os master integrators:**

```
[Webhook recebido]
       ↓
[Extrai phone + tenant_id do payload]
       ↓
[Supabase REST:
  GET /rest/v1/contacts
  ?phone=eq.{phone}
  &tenant_id=eq.{tenant_id}
  &select=id,is_muted]
       ↓
[Registro não existe]  → contato novo → continua normalmente
[is_muted = false]     → continua normalmente
[is_muted = true]      → STOP — workflow encerra sem processar
```

**Observações para implementação n8n:**
- Fail-open: se o Supabase retornar erro na consulta → continua (não bloqueia mensagem legítima por falha técnica)
- Verificar normalização do `phone` (ex: `5511999999999` vs `+5511999999999`) — deve ser consistente com o formato salvo no banco

---

### 4. UI

#### 4.1 Menu de 3 pontos — `components/livechat/conversation-header.tsx`

Nova opção no `DropdownMenuContent`:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem
  onClick={() => setShowMuteDialog(true)}
  className={contact.is_muted ? "text-green-600" : "text-destructive"}
>
  {contact.is_muted
    ? <><Bell className="h-4 w-4 mr-2" /> Remover silêncio</>
    : <><BellOff className="h-4 w-4 mr-2" /> Silenciar contato</>
  }
</DropdownMenuItem>
```

**Dialog de confirmação (ação: silenciar):**

> ⚠️ **Silenciar [Nome do contato]?**
>
> As mensagens deste contato serão descartadas automaticamente. A IA também será pausada.
>
> Você pode desfazer essa ação na aba **Silenciadas**.
>
> `[Cancelar]` `[Silenciar]`

#### 4.2 Lista de Conversas — Filtro

No query principal em `lib/queries/livechat.ts`, adicionar filtro:

```typescript
.eq('contacts.is_muted', false)  // exclui silenciados da lista principal
```

#### 4.3 Aba "Silenciadas" no Sidebar do Livechat

Adicionar nova aba ao lado de "Abertas" e "Fechadas":

```
Livechat sidebar
├── [Abertas]  [Fechadas]  [Silenciadas]   ← nova aba
│
└── Aba "Silenciadas":
    ├── Card do contato (avatar, nome, phone)
    ├── "Silenciado por: João em 20/03/2026"
    └── Botão: [Remover silêncio]
```

**Por que aba no livechat e não página separada?**
O atendente está no livechat quando decide silenciar — é natural desfazer no mesmo contexto, sem navegar para outra página.

---

## Sprint 2 — Sistema de Notificações

### Objetivo

Criar um canal centralizado para notificações do sistema, acessível via ícone no header (bell icon com badge).

### Tabela `notifications`

```sql
CREATE TABLE notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  type        text        NOT NULL,  -- 'mute_attempt', 'ia_error', 'billing_alert', etc.
  title       text        NOT NULL,
  body        text,
  metadata    jsonb,                 -- { contact_id, conversation_id, phone, ... }
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Tipos de notificação previstos

| Tipo | Trigger | Exemplo de mensagem |
|---|---|---|
| `mute_attempt` | Contato silenciado tenta enviar msg | "Pedro Silva tentou enviar uma mensagem (silenciado)" |
| `ia_error` | IA falha ao responder | "Erro ao processar resposta da IA na conversa #123" |
| `billing_alert` | Saldo baixo | "Saldo de créditos abaixo de 10%" |

### Fluxo — notificação de mute_attempt

```
[N8n detecta is_muted = true]
       ↓
[N8n chama POST /api/notifications/create]
  { type: "mute_attempt", contact_id, phone, tenant_id }
       ↓
[INSERT notifications]
       ↓
[Supabase Realtime emite evento]
       ↓
[Frontend atualiza badge do bell icon]
```

### API Routes (Sprint 2)

- `POST /api/notifications/create` — criada pelo n8n ao descartar mensagem
- `GET /api/notifications` — lista não lidas do tenant
- `PATCH /api/notifications/[id]/read` — marca como lida
- `PATCH /api/notifications/read-all` — marca todas como lidas

### UI — Bell Icon no Header

```
Top navbar
├── [Logo]  [Nav items...]
└── [🔔 3]  [Avatar]
      ↑
  Badge com contagem de não lidas
  Dropdown ou drawer com lista de notificações
  Cada item: ícone do tipo + título + tempo relativo + link para contexto
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Phone normalizado diferente no n8n | Média | Alto | Normalizar `phone` ao salvar contato e ao comparar no n8n — verificar padrão atual |
| N8n não tem acesso ao Supabase ainda | Baixa | Bloqueante | Verificar credentials antes de iniciar Sprint 1 |
| Atendente silencia por engano | Média | Médio | Dialog de confirmação + acesso fácil à aba "Silenciadas" |
| Performance: check extra por mensagem | Baixa | Baixo | Index `(tenant_id, phone) WHERE is_muted = true` mitiga |
| IA reativada por engano após unmute | Baixa | Médio | Unmute nunca reativa IA automaticamente |
| Supabase retorna erro no check do n8n | Baixa | Baixo | Fail-open: em caso de erro, continua o fluxo normal |

---

## Checklist Sprint 1

- [ ] Migration: `is_muted`, `muted_at`, `muted_by` na tabela `contacts`
- [ ] API: `POST /api/contacts/[id]/mute` (mute + unmute)
- [ ] API: `GET /api/contacts/muted`
- [ ] UI: nova opção no menu de 3 pontos (`conversation-header.tsx`)
- [ ] UI: dialog de confirmação de silenciar
- [ ] UI: filtro na query principal (excluir silenciados da lista)
- [ ] UI: aba "Silenciadas" no sidebar do livechat
- [ ] N8n: check de mute no master integrator Evolution
- [ ] N8n: check de mute no master integrator Meta Oficial
- [ ] Validar normalização do `phone` entre front, banco e n8n

## Checklist Sprint 2

- [ ] Migration: tabela `notifications`
- [ ] API: `POST /api/notifications/create`
- [ ] API: `GET /api/notifications`
- [ ] API: `PATCH /api/notifications/[id]/read` e `read-all`
- [ ] N8n: chamar `/api/notifications/create` ao descartar msg de silenciado
- [ ] UI: bell icon com badge no header
- [ ] UI: dropdown/drawer com lista de notificações
- [ ] Supabase Realtime: atualização automática do badge

---

## Arquivos que serão modificados (Sprint 1)

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/migrations/YYYYMMDD_mute_contact.sql` | Novo |
| `app/api/contacts/[id]/mute/route.ts` | Novo |
| `app/api/contacts/muted/route.ts` | Novo |
| `components/livechat/conversation-header.tsx` | Modificado |
| `components/livechat/livechat-content.tsx` | Modificado (nova aba) |
| `lib/queries/livechat.ts` | Modificado (filtro is_muted) |
| `types/livechat.ts` | Modificado (tipo Contact) |
| n8n — workflow Evolution master integrator | Modificado (externo) |
| n8n — workflow Meta Oficial master integrator | Modificado (externo) |
