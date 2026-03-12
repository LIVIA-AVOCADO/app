# Implementação: Módulo de Onboarding + Página de Signup

> **Status:** Planejado — aguardando início
> **Data do plano:** 2026-03-12
> **Escopo:** Onboarding wizard multi-nicho com provisionamento automático de tenant + página de cadastro de usuário via invite code

---

## 1. Princípios de Desenvolvimento

### 1.1 SOLID

| Princípio | Regra prática no projeto |
|-----------|--------------------------|
| **S** — Single Responsibility | Cada componente faz uma coisa. Steps só coletam dados. API routes processam uma operação. Queries em `lib/queries/`, validações em `lib/validations/`. |
| **O** — Open/Closed | Wizard renderer usa mapeamento estático `Record<string, Component>`. Novos steps = adicionar ao mapa, não modificar o renderer. Templates JSON extendem comportamento sem alterar código. |
| **L** — Liskov Substitution | Todos os step components aceitam o mesmo `StepProps`. Todas as API routes retornam o shape `{ data?, error? }`. |
| **I** — Interface Segregation | Interfaces TypeScript pequenas e focadas. `StepProps` só expõe o que o step precisa. Sem prop drilling desnecessário. |
| **D** — Dependency Inversion | Componentes dependem de abstrações (props, hooks, queries). Nenhum `createClient()` direto em componentes — isso fica nas queries/actions/API routes. |

### 1.2 Workflow Obrigatório

```bash
# Após CADA feature/sprint
npx eslint                # lint
npx tsc --noEmit          # type check

# Após GRANDES implementações (fim de sprint)
npm run build             # garantir que o build passa
```

**Regras inegociáveis:**
- Zero erros de lint antes de avançar ao próximo sprint
- Zero `@ts-ignore` sem comentário documentando o motivo
- Usar `(supabase as any)` com `// eslint-disable-next-line @typescript-eslint/no-explicit-any` apenas para tabelas do schema `onboarding` (sem tipos gerados inicialmente)

---

## 2. Feature: Página de Signup com Invite Code

### 2.1 Contexto

Usuários são criados manualmente no dashboard do Supabase. A solução é uma página de signup pública que usa o `invite_code` do dono do tenant para criar e associar automaticamente novos usuários.

### 2.2 Como funciona o invite_code

O campo `invite_code` (VARCHAR UNIQUE) em `public.users` é gerado automaticamente no primeiro login OAuth de cada usuário. Para o **dono do tenant** (quem fez onboarding ou foi criado pelo admin da plataforma), esse código **nunca é apagado** — ele serve como chave de convite permanente.

### 2.3 Fluxo

```
Tenant Owner
  ├─ fez onboarding → tem tenant_id + invite_code
  └─ criado pelo admin da plataforma → tem tenant_id + invite_code

Owner compartilha: app.livia.com/signup?invite=OWNER_CODE

Novo usuário → /signup?invite=CODE
  → preenche: nome, email, senha (código pré-preenchido)
  → POST /api/auth/signup
      ├─ busca owner por invite_code WHERE tenant_id IS NOT NULL
      ├─ adminClient.auth.admin.createUser({ email_confirm: true })
      ├─ INSERT public.users { tenant_id: owner.tenant_id, role: 'user' }
      └─ gera novo invite_code para o novo usuário
  → redirect /login com mensagem de sucesso
```

### 2.4 Arquivos

#### Criar
```
app/(auth)/signup/page.tsx            — Server Component, lê ?invite= de searchParams
components/auth/signup-form.tsx       — Client Component com os 4 campos
app/api/auth/signup/route.ts          — POST: valida código, cria auth.user + public.user
```

#### Modificar
```
middleware.ts                         — adicionar /signup e /api/auth/signup em PUBLIC_ROUTES
```

### 2.5 Lógica da API Route

```typescript
// POST /api/auth/signup
// 1. Zod validate
const signupSchema = z.object({
  full_name:   z.string().min(2, { message: 'Nome obrigatório' }),
  email:       z.string().email({ message: 'Email inválido' }),
  password:    z.string().min(8, { message: 'Mínimo 8 caracteres' }),
  invite_code: z.string().min(6, { message: 'Código inválido' }),
})

// 2. Buscar owner pelo invite_code
SELECT id, tenant_id FROM public.users
WHERE UPPER(invite_code) = UPPER($invite_code)
  AND tenant_id IS NOT NULL
LIMIT 1
// Erro genérico se não encontrar: "Código de convite inválido"

// 3. Criar usuário no Supabase Auth (admin)
adminClient.auth.admin.createUser({
  email, password,
  email_confirm: true,
  user_metadata: { full_name }
})

// 4. Inserir em public.users
INSERT INTO public.users {
  id:          auth_user.id,
  full_name,
  email,
  tenant_id:   owner.tenant_id,
  role:        'user',
  invite_code: gerar_6chars_unico(),
  modules:     []
}

// 5. Return { success: true } → client redireciona para /login
```

### 2.6 Segurança

- Rota pública (sem auth middleware)
- `createAdminClient()` apenas no servidor (API route), nunca no client
- Busca de `invite_code` é case-insensitive
- Mesma mensagem de erro para "código não existe" e "owner sem tenant" (não vazar informação)

---

## 3. Feature: Módulo de Onboarding

### 3.1 Objetivo

Wizard multi-nicho guiado que provisiona automaticamente um novo tenant ao final. Templates por nicho definem a estrutura do wizard. Integração com n8n para canal WhatsApp, vetorização de base de conhecimento e pós-ativação.

### 3.2 Princípios Arquiteturais

| Decisão | Justificativa |
|---------|---------------|
| `wizard_schema` define ordem/metadados, componentes React são fixos | Type safety + prevenção de code injection via JSON |
| Supabase Realtime para QR code (não polling) | Escala melhor, UX mais responsiva, fallback para polling de 3s se WS não conectar |
| RPC `activate_session` com `SECURITY DEFINER` | Precisa inserir em tabelas com RLS de `public.*` |
| `createAdminClient()` na rota de ativação | Operações em múltiplas tabelas, padrão já usado no projeto |
| Sessão sem `tenant_id` até ativação | Auth via `created_by = auth.uid()` durante o wizard |
| Callbacks n8n por `x-n8n-secret` | n8n não tem sessão JWT; consistente com `base-conhecimento-callback/route.ts` |
| Neurocore definido pelo template | Usuário não escolhe neurocore; cada template tem `default_neurocore_id` |

### 3.3 Estrutura do Payload JSONB

```json
{
  "company":            {},
  "business_profile":   {},
  "catalog":            {},
  "faq":                {},
  "service":            {},
  "script":             {},
  "channel":            {},
  "knowledge":          {},
  "agent":              {},
  "ai_operation":       {},
  "conversation_rules": {},
  "tags":               {},
  "activation":         {}
}
```

### 3.4 Schema SQL — Tabelas

```sql
CREATE SCHEMA IF NOT EXISTS onboarding;

-- Templates por nicho
CREATE TABLE onboarding.onboarding_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  niche                text NOT NULL,
  description          text,
  default_neurocore_id uuid NOT NULL REFERENCES public.neurocores(id),
  wizard_schema        jsonb NOT NULL DEFAULT '[]',
  default_payload      jsonb NOT NULL DEFAULT '{}',
  activation_rules     jsonb NOT NULL DEFAULT '{}',
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Sessões de onboarding
CREATE TABLE onboarding.tenant_onboarding_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES onboarding.onboarding_templates(id),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  tenant_id       uuid REFERENCES public.tenants(id),   -- preenchido após activate
  status          text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','in_progress','awaiting_channel',
               'ready_to_activate','activating','active','failed')
  ),
  payload         jsonb NOT NULL DEFAULT '{}',
  current_step    text,
  completed_steps text[] NOT NULL DEFAULT '{}',
  error_message   text,
  activated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Controle de conexão do canal WhatsApp
CREATE TABLE onboarding.onboarding_channel_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES onboarding.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','qr_ready','connected','failed')
  ),
  qr_code      text,
  phone_number text,
  whatsapp_id  text,
  n8n_job_id   text,
  connected_at timestamptz,
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_channel_requests_session_id_unique UNIQUE (session_id)
);

-- Outbox de jobs assíncronos para n8n
CREATE TABLE onboarding.onboarding_async_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES onboarding.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  job_type        text NOT NULL CHECK (job_type IN ('channel_provision','kb_vectorize','post_activation')),
  status          text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','processing','completed','failed')
  ),
  payload         jsonb NOT NULL DEFAULT '{}',
  result          jsonb,
  n8n_webhook_url text,
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE onboarding.onboarding_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.tenant_onboarding_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.onboarding_channel_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.onboarding_async_jobs        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view active templates"
  ON onboarding.onboarding_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Users manage own sessions"
  ON onboarding.tenant_onboarding_sessions FOR ALL TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users access channel requests of own sessions"
  ON onboarding.onboarding_channel_requests FOR ALL TO authenticated
  USING (session_id IN (
    SELECT id FROM onboarding.tenant_onboarding_sessions WHERE created_by = auth.uid()
  ));

CREATE POLICY "Service role full access on jobs"
  ON onboarding.onboarding_async_jobs FOR ALL TO service_role USING (true);

-- Realtime (para QR code polling)
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding.onboarding_channel_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding.tenant_onboarding_sessions;

-- Indexes
CREATE INDEX idx_sessions_created_by  ON onboarding.tenant_onboarding_sessions(created_by);
CREATE INDEX idx_sessions_status      ON onboarding.tenant_onboarding_sessions(status);
CREATE INDEX idx_sessions_template_id ON onboarding.tenant_onboarding_sessions(template_id);
CREATE INDEX idx_channel_req_session  ON onboarding.onboarding_channel_requests(session_id);
CREATE INDEX idx_jobs_session         ON onboarding.onboarding_async_jobs(session_id);
CREATE INDEX idx_jobs_status          ON onboarding.onboarding_async_jobs(status);
CREATE INDEX idx_templates_niche      ON onboarding.onboarding_templates(niche) WHERE is_active = true;
```

### 3.5 RPCs Supabase

#### `onboarding.create_session(p_template_id, p_created_by)`
- Cria sessão com `payload = template.default_payload`
- Retorna: row da sessão criada

#### `onboarding.save_step(p_session_id, p_step_key, p_step_payload, p_user_id)`
- `jsonb_set(payload, ARRAY[step_key], step_payload, true)`
- Adiciona step a `completed_steps`, atualiza `current_step`
- Muda status de `draft` → `in_progress` na primeira chamada
- Verifica ownership: `created_by = p_user_id`

#### `onboarding.validate_session(p_session_id, p_user_id)`
- Verifica `activation_rules.required_steps[]` do template
- Retorna: `{ ready: bool, missing: string[], stats: { completed_steps, status } }`

#### `onboarding.activate_session(p_session_id, p_user_id)`
- Trava sessão (`FOR UPDATE`) — garante idempotência
- Cria em `public.*`:
  - `tenants` (neurocore_id vem do template)
  - `wallets`
  - `agents` + `agent_prompts` + `agent_prompts_guard_rails` + `agent_prompts_intention` + `agent_prompts_internal_system` + `agent_prompts_observer`
  - `tags`
  - `tenant_conversation_timeout_settings`
  - `tenant_reactivation_settings` + `tenant_reactivation_rules_steps` + `tenant_reactivation_rules_steps_tags`
  - `base_conhecimentos` (metadados, `is_active = false`)
  - `channels` (somente se canal já conectado)
- Cria `onboarding_async_jobs`: `kb_vectorize` + `post_activation`
- Atualiza `users.tenant_id = novo_tenant_id`
- Marca sessão como `active`
- `SECURITY DEFINER` — corre como owner da função

#### `onboarding.channel_upsert_state(...)` — callback n8n
- UPSERT em `onboarding_channel_requests` pelo `session_id`
- Se `connected`: atualiza payload da sessão + muda status para `ready_to_activate`

#### `onboarding.kb_vectorize_result(...)` — callback n8n
- Atualiza `base_conhecimentos.is_active = true`
- Marca job como `completed`

#### `onboarding.post_activation_result(...)` — callback n8n
- Marca job como `completed` ou `failed`

### 3.6 Arquivos a Criar

```
# Tipos
types/onboarding.ts

# Queries e validações
lib/queries/onboarding.ts
lib/validations/onboarding-validation.ts

# API Routes — wizard
app/api/onboarding/sessions/route.ts                          # POST create_session
app/api/onboarding/sessions/[sessionId]/route.ts              # GET + PATCH save_step
app/api/onboarding/sessions/[sessionId]/validate/route.ts     # POST validate_session
app/api/onboarding/activate/route.ts                          # POST activate + dispara n8n
app/api/onboarding/channel-provision/route.ts                 # POST dispara webhook n8n canal

# API Routes — callbacks n8n
app/api/onboarding/callbacks/channel/route.ts                 # POST canal_upsert_state
app/api/onboarding/callbacks/kb-vectorize/route.ts            # POST kb_vectorize_result
app/api/onboarding/callbacks/post-activation/route.ts         # POST post_activation_result

# API Routes — admin templates
app/api/admin/onboarding-templates/route.ts                   # GET list + POST create
app/api/admin/onboarding-templates/[id]/route.ts              # GET + PUT + DELETE

# Páginas dashboard
app/(dashboard)/onboarding/page.tsx                           # Tela inicial: escolher template
app/(dashboard)/onboarding/[sessionId]/page.tsx               # Wizard principal
app/(dashboard)/onboarding/[sessionId]/channel/page.tsx       # QR code WhatsApp
app/(dashboard)/onboarding/[sessionId]/review/page.tsx        # Revisão & Ativar

# Páginas admin
app/(dashboard)/admin/onboarding-templates/page.tsx
app/(dashboard)/admin/onboarding-templates/[id]/page.tsx

# Componentes
components/onboarding/template-selector.tsx
components/onboarding/wizard-layout.tsx
components/onboarding/wizard-sidebar.tsx
components/onboarding/wizard-renderer.tsx
components/onboarding/steps/company-step.tsx
components/onboarding/steps/business-profile-step.tsx
components/onboarding/steps/catalog-step.tsx
components/onboarding/steps/faq-step.tsx
components/onboarding/steps/service-step.tsx
components/onboarding/steps/script-step.tsx
components/onboarding/steps/channel-step.tsx
components/onboarding/steps/knowledge-step.tsx
components/onboarding/steps/agent-step.tsx
components/onboarding/steps/ai-operation-step.tsx
components/onboarding/steps/conversation-rules-step.tsx
components/onboarding/steps/tags-step.tsx
components/onboarding/steps/review-step.tsx
components/onboarding/channel/qr-display.tsx
components/onboarding/channel/channel-status-poller.tsx
components/onboarding/review/validation-checklist.tsx
components/onboarding/review/activate-button.tsx
components/admin/onboarding-templates/templates-list.tsx
components/admin/onboarding-templates/template-form.tsx
```

### 3.7 Arquivos a Modificar

```
components/layout/nav-items.tsx     — adicionar entrada "Onboarding" (ícone Rocket)
middleware.ts                       — adicionar rotas de onboarding/callbacks como públicas
                                       para callbacks n8n (/api/onboarding/callbacks/*)
```

### 3.8 Webhooks n8n

| Webhook | Env Var | Quando disparar |
|---------|---------|-----------------|
| Canal WhatsApp | `WEBHOOK_N8N_ONBOARDING_CHANNEL_PROVISION` | Ao criar `channel_provision` job |
| Vetorização KB | `WEBHOOK_N8N_ONBOARDING_KB_VECTORIZATION` | Após `activate_session` |
| Pós-ativação | `WEBHOOK_N8N_ONBOARDING_POST_ACTIVATION` | Após `activate_session` |

Callbacks autenticados por `x-n8n-secret` (header) comparado com `process.env.N8N_CALLBACK_SECRET`.

### 3.9 O que a ativação provisiona em `public.*`

| Tabela | Origem no payload |
|--------|-------------------|
| `tenants` | `company.*` + `neurocore_id` do template |
| `wallets` | criado automaticamente (balance = 0) |
| `agents` | `agent.*` |
| `agent_prompts` | `agent.*` (persona, objetivo, comunicação) |
| `agent_prompts_guard_rails` | `ai_operation.prompts.guardrails` |
| `agent_prompts_intention` | `ai_operation.prompts.intentions` |
| `agent_prompts_internal_system` | `ai_operation.prompts.internal_system` |
| `agent_prompts_observer` | `ai_operation.prompts.observer` |
| `tags` | `tags.items[]` |
| `tenant_conversation_timeout_settings` | `conversation_rules.timeouts` |
| `tenant_reactivation_settings` | `conversation_rules.reactivation` |
| `tenant_reactivation_rules_steps` | `conversation_rules.reactivation_steps[]` |
| `tenant_reactivation_rules_steps_tags` | steps com `tags_to_apply[]` |
| `base_conhecimentos` | `knowledge.*` (metadados, `is_active = false`) |
| `channels` | `channel.*` (somente se `connection_status = connected`) |
| `users.tenant_id` | atualiza o usuário criador |

---

## 4. Plano de Sprints

### Sprint 0 — Fundação SQL (pré-requisito para tudo)
- [ ] Executar SQL no Supabase: schema `onboarding`, 4 tabelas, RLS, indexes, Realtime
- [ ] Criar RPCs: `create_session`, `save_step`, `validate_session`
- [ ] Esqueleto da RPC `activate_session` (ajustar campos conforme testes)
- [ ] Criar `types/onboarding.ts`

### Sprint 1 — Signup com Invite Code
- [ ] `app/api/auth/signup/route.ts`
- [ ] `components/auth/signup-form.tsx`
- [ ] `app/(auth)/signup/page.tsx`
- [ ] Atualizar `middleware.ts` (rotas públicas)
- [ ] **Lint + typecheck + build**

### Sprint 2 — Tela Inicial + Wizard Base
- [ ] `lib/queries/onboarding.ts` (`getTemplates`, `getSession`, `getUserSessions`)
- [ ] `lib/validations/onboarding-validation.ts`
- [ ] `app/api/onboarding/sessions/route.ts` (POST)
- [ ] `app/api/onboarding/sessions/[sessionId]/route.ts` (GET + PATCH)
- [ ] `app/(dashboard)/onboarding/page.tsx` + `template-selector.tsx`
- [ ] `app/(dashboard)/onboarding/[sessionId]/page.tsx`
- [ ] `wizard-layout.tsx` + `wizard-sidebar.tsx` + `wizard-renderer.tsx`
- [ ] Steps prioritários: `company`, `agent`, `knowledge`, `tags`
- [ ] Adicionar "Onboarding" ao `nav-items.tsx`
- [ ] **Lint + typecheck + build**

### Sprint 3 — Canal WhatsApp (QR)
- [ ] `app/api/onboarding/channel-provision/route.ts`
- [ ] `app/api/onboarding/callbacks/channel/route.ts`
- [ ] RPC `onboarding.channel_upsert_state`
- [ ] `app/(dashboard)/onboarding/[sessionId]/channel/page.tsx`
- [ ] `qr-display.tsx` + `channel-status-poller.tsx` (Supabase Realtime)
- [ ] Atualizar `middleware.ts` (callbacks como rotas públicas)
- [ ] **Lint + typecheck + build**

### Sprint 4 — Validação + Ativação
- [ ] `app/api/onboarding/sessions/[sessionId]/validate/route.ts`
- [ ] `app/api/onboarding/activate/route.ts` (chama RPC + dispara webhooks n8n)
- [ ] `app/api/onboarding/callbacks/kb-vectorize/route.ts`
- [ ] `app/api/onboarding/callbacks/post-activation/route.ts`
- [ ] RPCs: `activate_session`, `kb_vectorize_result`, `post_activation_result`
- [ ] `app/(dashboard)/onboarding/[sessionId]/review/page.tsx`
- [ ] `validation-checklist.tsx` + `activate-button.tsx`
- [ ] **Lint + typecheck + build**

### Sprint 5 — Admin Templates
- [ ] `app/api/admin/onboarding-templates/` (CRUD)
- [ ] `app/(dashboard)/admin/onboarding-templates/` (páginas)
- [ ] `templates-list.tsx` + `template-form.tsx` (editor JSON para wizard_schema)
- [ ] **Lint + typecheck + build**

### Sprint 6 — Steps Secundários + Polimento
- [ ] Steps restantes: `business-profile`, `catalog`, `faq`, `service`, `script`, `ai-operation`, `conversation-rules`
- [ ] Deep link por URL `?step=company`
- [ ] Estados de erro, empty e loading consistentes em todas as telas
- [ ] **Lint + typecheck + build final**

---

## 5. Variáveis de Ambiente Necessárias

```bash
# Já existentes
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Novas (onboarding)
N8N_CALLBACK_SECRET=                          # valida callbacks do n8n
WEBHOOK_N8N_ONBOARDING_CHANNEL_PROVISION=     # URL webhook n8n canal
WEBHOOK_N8N_ONBOARDING_KB_VECTORIZATION=      # URL webhook n8n vetorização
WEBHOOK_N8N_ONBOARDING_POST_ACTIVATION=       # URL webhook n8n pós-ativação
```

---

## 6. Referências de Padrões do Projeto

| Padrão | Arquivo de referência |
|--------|----------------------|
| API route (auth + Zod + tenant) | `app/api/quick-replies/route.ts` |
| Server Component com auth + fetch | `app/(dashboard)/reativacao/page.tsx` |
| Queries com `(supabase as any)` | `lib/queries/reactivation.ts` |
| Callback externo sem auth | `app/api/n8n/base-conhecimento-callback/route.ts` |
| Admin client | `lib/supabase/admin.ts` |
| Nav items com subitems | `components/layout/nav-items.tsx` |
