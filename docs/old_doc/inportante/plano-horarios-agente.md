# Plano — Feature: Horários do Agente de IA

**Status:** Em desenvolvimento
**Data:** 2026-03-25
**Projeto:** livia_dev_01

---

## Objetivo

Permitir que cada tenant configure os horários em que o agente de IA estará online para responder mensagens. Fora do horário configurado, o sistema faz transbordo automático para um atendente humano e envia uma mensagem configurável ao cliente.

**Exceção 24/7:** Se o tenant não tiver nenhum horário configurado, o sistema funciona normalmente sem nenhuma consulta de horário — zero impacto no fluxo atual.

---

## Comportamento esperado

| Situação | Comportamento |
|---|---|
| Tenant sem horários configurados | Agente sempre online (24/7), nenhuma consulta ao banco |
| Mensagem recebida dentro do horário | Fluxo normal — IA responde |
| Mensagem recebida fora do horário | n8n envia mensagem de "fora do horário" + transbordo para humano |
| Horário encerra com conversa ativa | Conversa é encerrada (ia_active = false) + transbordo automático |
| Feriado / data bloqueada | Tratado como fora do horário o dia inteiro |
| Data com horário excepcional | Substitui o horário semanal padrão para aquela data |

---

## Arquitetura

### Fluxo de mensagem recebida

```
WhatsApp / Evolution API
        ↓
       n8n
        ↓
  GET /api/agent-schedule/is-online?tenant_id=xxx
        ↓
   [offline] ──→ envia mensagem "fora do horário" → transbordo humano
        ↓
   [online]  ──→ fluxo normal de IA
        ↓
  Salva mensagem no DB
        ↓
  Livia lê via Realtime (UI)
```

### Transição automática (agente vai offline durante conversa ativa)

```
pg_cron (a cada 5 minutos)
        ↓
  Executa RPC: handle_agent_schedule_transitions()
        ↓
  Busca tenants cujo horário acabou de encerrar
        ↓
  Para cada conversa aberta com ia_active = true:
    → ia_active = false
    → Chama n8n webhook (N8N_PAUSE_IA_WEBHOOK)
    → n8n envia mensagem de transbordo ao cliente
```

### Decisão de timezone

Armazenar `timezone text DEFAULT 'America/Sao_Paulo'` nas tabelas de horário.
- Não exposto na UI por enquanto (valor default aplicado automaticamente)
- Garante comparações corretas no RPC e no cron
- À prova de futuro: se cliente de outro fuso entrar, basta mudar o campo

---

## Database

### Tabela: `agent_schedule_weekly`

Horários recorrentes por dia da semana. Suporta múltiplos intervalos por dia (ex: pausa para almoço).

```sql
CREATE TABLE agent_schedule_weekly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=domingo, 1=segunda, ..., 6=sábado
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  offline_message TEXT,
  -- Mensagem enviada ao cliente quando fora do horário.
  -- Se NULL, usa mensagem padrão do sistema.
  timezone        TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_time_range CHECK (end_time > start_time),
  UNIQUE (tenant_id, day_of_week, start_time)
);
```

**Exemplos de registros:**
- Seg–Sex 08h–18h → 5 registros (day_of_week 1–5)
- Seg com pausa para almoço → 2 registros para day_of_week=1: (08:00–12:00) e (13:00–18:00)

### Tabela: `agent_schedule_exceptions`

Datas específicas que substituem ou bloqueiam o horário semanal.

```sql
CREATE TABLE agent_schedule_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exception_date  DATE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('blocked', 'custom')),
  -- 'blocked' = dia inteiro offline (feriado)
  -- 'custom'  = horário diferente do padrão (substitui weekly neste dia)
  start_time      TIME,  -- NULL se type = 'blocked'
  end_time        TIME,  -- NULL se type = 'blocked'
  label           TEXT,  -- ex: "Natal", "Recesso de julho"
  timezone        TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_custom_times CHECK (
    type = 'blocked' OR (start_time IS NOT NULL AND end_time IS NOT NULL)
  ),
  CONSTRAINT chk_custom_range CHECK (
    type = 'blocked' OR end_time > start_time
  ),
  UNIQUE (tenant_id, exception_date, start_time)
);
```

### RPC: `is_agent_online(p_tenant_id uuid) → boolean`

Lógica em ordem de prioridade:

1. Se não há nenhum registro em `agent_schedule_weekly` para o tenant → retorna `true` (24/7)
2. Busca exceção para hoje (`agent_schedule_exceptions`):
   - `type = 'blocked'` → retorna `false`
   - `type = 'custom'` → verifica se `now()` (no timezone do tenant) está dentro do intervalo custom
3. Busca registros semanais ativos para o dia da semana atual
4. Verifica se `now()` está dentro de algum intervalo → retorna `true` se sim, `false` se não

### RPC: `handle_agent_schedule_transitions()`

Chamado pelo pg_cron a cada 5 minutos.

Lógica:
1. Para cada tenant com horários configurados:
   - Verifica se o agente está offline agora (`is_agent_online = false`)
   - Busca conversas com `ia_active = true` e `status = 'open'`
   - Para cada uma: seta `ia_active = false`, registra motivo
   - Chama n8n via `pg_net` (webhook de pause-ia)
2. (Opcional) Detecta tenants que voltaram online — para log/notificação futura

### pg_cron

```sql
SELECT cron.schedule(
  'agent-schedule-transitions',
  '*/5 * * * *',
  $$SELECT handle_agent_schedule_transitions()$$
);
```

---

## API Route

### `GET /api/agent-schedule/is-online`

Consultado pelo n8n antes de processar cada mensagem recebida.

**Query params:** `tenant_id` (uuid)

**Response:**
```json
{ "online": true }
// ou
{ "online": false, "offline_message": "Nosso atendimento funciona de seg–sex 08h–18h." }
```

---

## UI — `/configuracoes/horarios-agente`

### Seção 1: Status atual
- Badge grande: `● Online agora` / `○ Offline agora`
- Subtítulo dinâmico: "Vai offline em 2h30min" | "Volta online amanhã às 08h00" | "Online 24/7"

### Seção 2: Horário semanal
- Tabela com os 7 dias da semana
- Toggle on/off por dia
- Para cada dia ativo: linha(s) com input de início e fim
- Botão `+ Adicionar intervalo` (para pausa de almoço etc.)
- Botão de remover intervalo
- Campo: mensagem padrão fora do horário (textarea, global por tenant)

### Seção 3: Exceções / Datas especiais
- Botão `+ Adicionar exceção`
- Dialog: seletor de data + tipo (Bloquear dia inteiro / Horário personalizado) + label
- Lista das exceções configuradas (ordenada por data) com botão excluir

---

## Permissões

Módulo adicionado ao sistema `users.modules`:

| Módulo | Quem pode usar |
|---|---|
| `horarios_agente` | admin (sempre) + users autorizados pelo admin |

A autorização segue o padrão existente em `/gerenciar-usuarios`.

---

## Arquivos a criar/modificar

```
livia_dev_01/
├── supabase/migrations/
│   └── YYYYMMDD_agent_schedule.sql          ← tabelas + RPCs + pg_cron
│
├── app/(dashboard)/configuracoes/
│   └── horarios-agente/
│       └── page.tsx
│
├── components/configuracoes/
│   └── horarios-agente/
│       ├── schedule-status-badge.tsx         ← badge online/offline
│       ├── weekly-schedule-form.tsx          ← tabela semanal
│       ├── exceptions-manager.tsx            ← datas especiais
│       └── offline-message-form.tsx          ← mensagem configurável
│
├── lib/queries/
│   └── agent-schedule.ts                    ← queries CRUD
│
├── app/actions/
│   └── agent-schedule.ts                    ← server actions
│
└── app/api/
    └── agent-schedule/
        └── is-online/
            └── route.ts                     ← endpoint para n8n
```

---

## Ordem de implementação

1. **Migration SQL** — tabelas, RPCs, cron
2. **API Route** `/api/agent-schedule/is-online` — para n8n poder consultar
3. **Queries + Server Actions** — CRUD das configurações
4. **UI** — página de configurações com os 3 blocos
5. **Permissões** — adicionar módulo `horarios_agente`

---

## Decisões técnicas registradas

- **pg_cron + pg_net**: mesmo padrão já usado em `miss_belle_app` (trial expiry cron)
- **Abordagem híbrida**: check inline via n8n (mensagens novas) + cron (conversas ativas em transição)
- **Timezone default**: `America/Sao_Paulo` hardcodado como default, campo presente para expansão futura
- **Exceção 24/7**: ausência de registros = sem consulta = sem overhead
- **offline_message**: campo opcional; se NULL usa mensagem padrão do sistema
