# Onboarding Conversacional — livia_dev_01

## Visão geral do fluxo

```
/onboarding  (entry-form)
  → preenche nome empresa + funcionários + site + nicho
  → POST /api/onboarding/sessions           (cria sessão)
  → PATCH /api/onboarding/sessions/[id]     (salva company no payload)
  → redireciona para /onboarding/[sessionId]/chat

/onboarding/[sessionId]/chat  (chat com IA)
  → lê sessão do DB (payload.company)
  → renderiza OnboardingChat com contexto da empresa
  → cada mensagem: POST /api/onboarding/chat → n8n → resposta
```

## Arquivos criados/modificados

### Páginas (route group `(auth)` — SEM sidebar)
- `app/(auth)/onboarding/page.tsx` — server component, carrega templates + sessão anterior, renderiza `OnboardingEntryForm`
- `app/(auth)/onboarding/[sessionId]/chat/page.tsx` — server component, lê sessão, passa contexto para `OnboardingChat`
- `app/(auth)/onboarding/[sessionId]/page.tsx` — movido de `(dashboard)` para `(auth)`
- `app/(auth)/onboarding/[sessionId]/review/page.tsx` — movido de `(dashboard)` para `(auth)`
- `app/(auth)/aguardando-acesso/page.tsx` — movido de `(dashboard)` para `(auth)`

> Sidebar não faz sentido em páginas pré-ativação (sem workspace). Route group `(auth)` herda layout sem sidebar.

### Componentes
- `components/onboarding/entry-form.tsx` — formulário inicial com 12 cards de nicho
- `components/onboarding/chat/onboarding-chat.tsx` — interface de chat com tela de boas-vindas + bubbles

### API Routes
- `app/api/onboarding/chat/route.ts`
  - **GET** — diagnóstico: testa conexão com n8n sem auth de usuário. Retorna `env_ok`, `http_status`, `body`
  - **POST** — proxy seguro: valida auth Supabase, monta payload flat, chama n8n, retorna `reply`

### Tipos
- `types/onboarding.ts` — `CompanyPayload` extendido com `employee_count`, `website`, `has_no_website`, `niche`

### Env vars (`.env.local` e Vercel)
```
N8N_BASE_URL=https://acesse.ligeiratelecom.com.br
N8N_ONBOARDING_CHAT_WEBHOOK=/webhook/chat_onboarding
N8N_ONBOARDING_CHAT_API_KEY=<ver .env.local>
```
> Todas as três variáveis são obrigatórias em produção (Vercel). A autenticação está **ativa**.

## Payload enviado ao n8n (flat)

```json
{
  "session_id":        "uuid-da-sessao",
  "message":           "mensagem do usuário",
  "user_id":           "uuid-do-user-supabase",
  "user_name":         "Nome do Usuário",
  "user_email":        "email@exemplo.com",
  "company_name":      "Nome da Empresa",
  "company_niche":     "saude",
  "company_employees": "2 a 5",
  "company_website":   "https://site.com"
}
```

Campos acessíveis no n8n como `{{ $json.campo }}`.

## Resposta esperada do n8n

O código tenta extrair reply nesta ordem de prioridade:
```typescript
data.reply ?? data.output ?? data.text ?? data.message ?? rawText
```

O n8n deve retornar JSON com campo `reply`:
```json
{ "reply": "Olá! Vamos começar..." }
```

## Autenticação n8n

- O n8n usa **Header Auth** com nome de header exatamente `apikey` (não `Authorization`)
- Autenticação **ativa** — header `'apikey': process.env.N8N_ONBOARDING_CHAT_API_KEY!` enviado em todo fetch ao n8n
- Configurar `N8N_ONBOARDING_CHAT_API_KEY` nas variáveis de ambiente da Vercel para produção

## Diagnóstico

**Como testar conexão com n8n (sem auth de usuário):** acessar via GET no browser:
```
https://[url-producao]/api/onboarding/chat
```
- `env_ok: false` → faltam vars na Vercel → adicionar `N8N_BASE_URL` e `N8N_ONBOARDING_CHAT_WEBHOOK`
- `env_ok: true` + `http_status: 500` → problema no workflow n8n
- `env_ok: true` + `body: "(vazio)"` → Respond to Webhook node não configurado no n8n

### Histórico de erros resolvidos (2026-03-29)
- **Erro 500/404 no envio de mensagem** — resolvido: variáveis de env ausentes na Vercel + reativação da autenticação `apikey` (commit `9b890c5`)

### Problemas identificados no workflow n8n

1. **Edit Fields node em modo Replace** — apaga todos os campos recebidos
   - Corrigir: ativar "Keep All Fields" no node Edit Fields

2. **AI Agent node sem campo Prompt configurado**
   - Corrigir: definir Prompt como `{{ $json.message }}`

3. **Simple Memory sem Session Key por sessão**
   - Corrigir: definir Session Key como `{{ $('Webhook').item.json.session_id }}`

4. **Respond to Webhook sem body configurado**
   - Corrigir: definir body como `{ "reply": "{{ $json.output }}" }`
   - Ou: `{ "reply": "{{ $json.text }}" }` dependendo do modelo de AI Agent usado

5. **Supabase Get node sem tabela configurada** (causava crash 500)
   - Verificar se o node está configurado corretamente ou remover se não for necessário

## Nichos disponíveis no formulário

`saude`, `ecommerce`, `imobiliaria`, `alimentacao`, `beleza`, `educacao`, `fitness`, `juridico`, `construcao`, `veiculos`, `tecnologia`, `financeiro`

## Dados persistidos no banco

- Tabela: `onboarding.tenant_onboarding_sessions`
- Coluna JSONB: `payload`
- Step key: `'company'`
- Campos: `trade_name`, `employee_count`, `website`, `has_no_website`, `niche`
- Funções RPC: `onboarding_create_session`, `onboarding_save_step`

## Próximas etapas planejadas (não implementadas)

1. **Cadastro do canal Evolution API** — número WhatsApp via Evolution API
3. **Agente 2 (MCP executor)** — após entrevista com agente 1, um segundo agente usaria MCP para criar o pré-cadastro automaticamente
4. **Tela de review/confirmação** — usuário valida dados antes da ativação final
