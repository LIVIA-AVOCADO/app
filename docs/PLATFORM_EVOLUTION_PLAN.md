# LIVIA Platform Evolution Plan
# Livechat → CRM-Grade Multi-Agent Platform

**Data:** 2026-04-20  
**Status:** Planejado — aguardando execução por fases  
**Autores:** Frank Marcelino + Claude  

---

## ⚠️ Diretrizes Críticas de Deploy e Migração

> Estas regras se aplicam a **todas as fases** e devem ser respeitadas antes de qualquer
> commit, deploy ou mudança de configuração em produção.

### D-001 — Deploy automático: cada commit no `main` vai direto para produção

O repositório `livia_dev_01` está conectado à Vercel com deploy automático na branch `main`.
Isso significa que **qualquer push impacta usuários reais imediatamente**.

Regras obrigatórias:
- Nunca commitar código incompleto em arquivos que afetam rotas ativas (middleware, livechat, APIs)
- Toda alteração deve passar por `npm run build` localmente antes do commit
- Features em andamento que afetam fluxo de produção devem usar feature flags ou ficar em branch separada até estar 100% pronta
- Commits de documentação e de código Go (repositório separado) **não afetam** a Vercel

### D-002 — n8n é o único processador de mensagens hoje — nunca desligar sem validação completa

O fluxo atual é:
```
Canal (Evolution/Meta) → webhook → n8n → processa TUDO → Supabase
```

O n8n processa: recebimento, roteamento, IA, gravação de mensagens, status, envio.
**Se o n8n cair, nenhuma mensagem chega ao sistema.**

Regras obrigatórias:
- O n8n só sai do caminho de inbound quando o Go Gateway estiver **validado em produção**
  com volume real por no mínimo 48h sem erros
- Durante toda a Fase 2, o n8n continua ativo como fallback — basta re-apontar o webhook
  da Evolution/Meta de volta para o n8n para fazer rollback em segundos
- Salvar e documentar as URLs de webhook do n8n antes de qualquer mudança de roteamento

### D-003 — livia-gateway é um repositório separado — zero risco para o Next.js

O Go Message Gateway será desenvolvido e deployado em um repositório independente
(`livia-gateway`), rodando na VPN Hostinger. Ele **não compartilha** código, deploy
pipeline ou dependências com o repositório Next.js.

Consequência: todo o desenvolvimento da Fase 2 pode ser feito sem nenhum commit
no `livia_dev_01`. O Next.js só é tocado no último passo (quando o envio outbound
migra de n8n para Go), e mesmo assim de forma incremental.

### D-004 — Shadow Mode é obrigatório antes de qualquer cutover

Antes de o Go Gateway processar qualquer mensagem real:
1. Ele deve rodar em **shadow mode**: recebe o webhook, loga, mas **não age**
2. O n8n continua recebendo o mesmo webhook em paralelo (dual-write)
3. Só avança para o próximo passo após validar logs por no mínimo 24h

Nunca pular o shadow mode, mesmo que os testes locais estejam passando.

### D-005 — Rollback deve ser possível em menos de 60 segundos

Para cada passo da migração, o rollback deve ser:
- **Documentado** antes de executar o passo
- **Testado** (saber exatamente o que clicar para reverter)
- **Rápido**: re-apontar webhook no painel da Evolution/Meta é suficiente para
  voltar ao n8n em qualquer ponto da Fase 2

### D-006 — Credenciais nunca em código ou documentação pública

A seção 6.7 contém exemplos de variáveis de ambiente com valores reais de referência.
Esses valores **não devem** ser commitados no repositório real do `livia-gateway`.
Usar `.env` local + secrets do servidor (ou vault) para todas as credenciais.

---

## Índice

1. [Contexto e Visão Geral](#1-contexto-e-visão-geral)
2. [Diagnóstico Técnico do Estado Atual](#2-diagnóstico-técnico-do-estado-atual)
3. [Decisões Arquiteturais Aprovadas](#3-decisões-arquiteturais-aprovadas)
4. [Fase 0 — Performance Imediata (Next.js)](#4-fase-0--performance-imediata-nextjs)
5. [Fase 1 — Modularização do Código](#5-fase-1--modularização-do-código)
6. [Fase 2 — Go Message Gateway](#6-fase-2--go-message-gateway)
7. [Fase 3 — Multi-Agente e URA Engine](#7-fase-3--multi-agente-e-ura-engine)
8. [Fase 4 — Tela de Logs de Canal](#8-fase-4--tela-de-logs-de-canal)
9. [Fase 5 — Evolução CRM](#9-fase-5--evolução-crm)
10. [Schema de Banco Completo](#10-schema-de-banco-completo)
11. [Infraestrutura Final](#11-infraestrutura-final)
12. [Roadmap e Prioridades](#12-roadmap-e-prioridades)

---

## 1. Contexto e Visão Geral

### Estado atual da plataforma

- **Frontend + BFF:** Next.js 15 / Vercel
- **Banco + Auth + Realtime:** Supabase
- **Automações e IA:** n8n rodando na VPN Hostinger
- **Canais:** Evolution API (WhatsApp) + Meta WhatsApp Cloud API

### Fluxo atual de mensagens

```
INBOUND (mensagem recebida):
  Canal (Evolution/Meta)
       ↓ webhook
     n8n (first integrator)
       ↓ processa tudo — IA, humano, status, routing
     n8n (master integration)
       ↓ grava
     Supabase ──→ Realtime ──→ Frontend

OUTBOUND (agente humano envia):
  Frontend → Next.js API → n8n → Evolution/Meta
                               ↓ webhook de confirmação
                             n8n → Supabase (status=sent)
```

### Problemas identificados

1. **n8n é gargalo único:** toda mensagem passa pelo n8n, mesmo conversas puramente humanas
2. **Sem conceito de agente atribuído:** qualquer usuário vê tudo, não existe "meus atendimentos"
3. **Sem roteamento de entrada (URA):** não há regras para decidir quem atende o quê
4. **Lentidão no livechat:** 3 causas concretas identificadas no código (ver Seção 2)
5. **Sem logs de conexão de canais:** debugging cego quando Evolution/Meta falha
6. **IA misturada ao fluxo operacional:** conceitualmente, a IA deveria ser "mais um atendente"

### Visão alvo

```
Canal (Evolution/Meta/futuro)
       ↓ webhook
  Go Message Gateway (novo — VPN Hostinger)
       ↓ autentica, normaliza, deduplica, persiste
  URA Engine (Go)
       ↓ avalia regras de roteamento
       ├── Rota humano → Supabase Realtime → inbox do agente
       ├── Rota IA → n8n workflow → resposta automática
       └── Rota fila → queue table → agente pega manualmente

  n8n: exclusivamente workflows de IA
  Next.js: frontend + BFF (CRUD simples → Supabase)
  Go: alta carga, webhooks, roteamento, envio outbound
```

---

## 2. Diagnóstico Técnico do Estado Atual

### 2.1 Causa raiz da lentidão do livechat

#### Problema A — Middleware faz 2-3 queries Supabase em cada navegação

**Arquivo:** `middleware.ts`

```typescript
// PROBLEMA: executa em TODA request ao dashboard
async function handleDashboardMiddleware(...) {
  await supabase.auth.getUser()            // HTTP call #1 → Supabase Auth (~80ms)
  await supabase.from('users').select(...)  // HTTP call #2 → banco (~60ms)
  await adminClient.from('tenants').select(...) // HTTP call #3 → banco (~60ms)
}
// Total: 200-600ms ANTES de qualquer lógica de negócio
// Em Vercel serverless com cold start: +200-500ms adicionais
```

**Impacto:** cada clique em qualquer rota do dashboard paga esse custo.

#### Problema B — SSR completo em cada troca de conversa

**Arquivo:** `app/(dashboard)/livechat/page.tsx`

```typescript
// Executa A CADA CLIQUE em uma conversa diferente (router.push)
const [convs, closed, important, tags, counts] = await Promise.allSettled([
  getConversationsWithContact(tenantId, { limit: ... }),    // ~100ms
  getConversationsWithContact(tenantId, { status:'closed' }), // ~100ms
  getConversationsWithContact(tenantId, { isImportant: true }), // ~80ms
  getAllTags(...),                                           // ~40ms
  getLivechatTabStatusCounts(tenantId),                     // ~30ms
])
// Total: 1-2s por clique em conversa
```

**Nota:** a arquitetura de navegação client-side (Fase 5) está documentada no
`LIVECHAT_PERFORMANCE_PLAN.md` mas **ainda não foi implementada**.

#### Problema C — WebSocket Realtime pode não passar pelo proxy do fix ISP

**Contexto:** fix aplicado anteriormente redirecionou tráfego Supabase por Vercel,
resolvendo bloqueio de ISP. Porém o WebSocket do Realtime é estabelecido diretamente
do browser (`createBrowserClient` com `NEXT_PUBLIC_SUPABASE_URL`).

**Risco:** se o ISP bloqueia a URL direta do Supabase, o Realtime falha silenciosamente
— o hook tenta reconectar com backoff exponencial, mas o usuário simplesmente não vê
atualizações.

**Como verificar:** DevTools → Network → filtrar por `WS` → ver endpoint de conexão.
Se for `wss://[projeto].supabase.co` diretamente, o problema pode persistir para
usuários de ISPs restritivos.

### 2.2 Limitações de arquitetura de médio prazo

| Limitação | Impacto ao crescer |
|---|---|
| n8n no caminho de toda mensagem | Gargalo em volume alto, ponto único de falha |
| Sem atribuição de agente (`assigned_to`) | Impossível escalar equipe de atendimento |
| Sem URA/roteamento | Toda mensagem vai para um pool genérico |
| IA hardcoded como "sistema" | Não pode ser desativada por conversa via regra |
| Sem logs de canal | Impossível diagnosticar problemas de conexão |

---

## 3. Decisões Arquiteturais Aprovadas

### DA-001: Next.js não será reescrito em Go

**Decisão:** manter Next.js para frontend e rotas BFF (CRUD → Supabase).  
**Justificativa:** o gargalo das rotas BFF é a query de banco (network-bound), não o
runtime. Reescrever 30+ rotas funcionando em Go custaria 2-3 meses sem benefício
mensurável — o mesmo tempo que levaria para implementar URA, multi-agente e CRM.  
**Exceção:** serviços novos de alta carga (Message Gateway, URA Engine, WS Proxy)
são criados diretamente em Go.  
**Migração futura:** rotas BFF migram para Go oportunisticamente — quando uma rota
precisar de refactor por outra razão, reescreve em Go. Não reescreve o que funciona.

### DA-002: Go é introduzido para responsabilidades específicas

**Responsabilidades Go:**
- Message Gateway (recebe webhooks de canais)
- URA Engine (roteamento de conversas)
- WebSocket Proxy (resolve bloqueio ISP para Realtime)
- Outbound sender (envia mensagens para canais externos)
- Channel health monitor (logs de conexão)
- Futuros jobs pesados (exports, relatórios batch)

**Responsabilidades Next.js (mantidas):**
- Frontend React / Server Components
- Rotas BFF (auth + CRUD Supabase)
- Middleware de auth/permissões

### DA-003: n8n passa a ter responsabilidade única — workflows de IA

**Antes:** n8n processa tudo (recebimento, roteamento, envio, status, IA)  
**Depois:** n8n apenas executa quando URA Engine decide que a rota é IA

**Consequência:** se n8n cair, apenas o atendimento por IA para. Conversas humanas
continuam funcionando normalmente via Go Gateway + Supabase Realtime.

### DA-004: IA é tratada como atendente, não como sistema separado

**Conceito:** do ponto de vista do URA Engine, um atendente humano e um agente IA
são do mesmo tipo — ambos têm `capacidade`, `disponibilidade` e `habilidades`.
A diferença é apenas no handler de atribuição:

- Atribuído para humano → Supabase Realtime notifica inbox do agente
- Atribuído para IA → Go Gateway POST no n8n workflow

**Exceção:** funcionalidades que dependem de IA como ferramenta (reativação,
resumo de conversa, base de conhecimento) permanecem disponíveis independente
do modo de roteamento.

### DA-005: Configuração flexível por tenant

```
Modo 1: URA (multi-agente)
  → Regras de roteamento ativas
  → IA é mais um atendente nas regras
  → Times, agentes humanos e agente IA coexistem

Modo 2: Intent Agent (agente único)
  → Sem regras URA
  → Toda mensagem vai para IA automaticamente
  → Ideal para tenants sem equipe de atendimento humano

Modo 3: Direto (sem automação)
  → Sem IA automática
  → Tudo vai para fila → agente pega manualmente
```

### DA-006: Realtime Supabase via WebSocket Proxy Go

Para garantir que 100% dos usuários recebam atualizações em tempo real,
independente de ISP:

```
Browser → wss://realtime.seudominio.com.br (Go Proxy — Hostinger)
               ↓ proxy bidirecional
          wss://[projeto].supabase.co/realtime/v1 (Supabase)
```

Todos os usuários se conectam ao domínio próprio. ISP não consegue bloquear
porque o tráfego passa pelo servidor VPS já em uso.

---

## 4. Fase 0 — Performance Imediata (Next.js)

**Objetivo:** resolver a lentidão do livechat sem introduzir Go.  
**Prazo estimado:** 1-2 semanas  
**Arquivos afetados:** `middleware.ts`, `livechat/page.tsx`, `livechat-content.tsx`,
`lib/supabase/client.ts`

---

### 4.1 Fix A — Middleware: validar JWT localmente

**Problema:** middleware faz HTTP call para `supabase.auth.getUser()` em cada request.  
**Solução:** verificar o JWT do cookie localmente usando a chave secreta do Supabase.

```typescript
// middleware.ts — ANTES
const { data: { user } } = await supabase.auth.getUser() // ~80ms HTTP call

// middleware.ts — DEPOIS
import { jwtVerify, createRemoteJWKSet } from 'jose'

// JWT verificado localmente — zero network call
const token = request.cookies.get('sb-access-token')?.value
  ?? extractTokenFromAuthHeader(request)

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)
// JWKS é cacheado automaticamente pelo jose — só busca na primeira vez

const { payload } = await jwtVerify(token, JWKS)
const userId = payload.sub
const userEmail = payload.email
```

**Para `tenant_id`, `role`, `modules`:** mover para claims customizados do JWT
(Supabase suporta via `auth.users.raw_app_meta_data`) ou manter em cookie
HTTPOnly com TTL curto (mesmo padrão já usado para `x-sub-status`).

```typescript
// Cookie de contexto do usuário — setado no login, renovado a cada mudança
// x-user-ctx: { tenant_id, role, modules } — JWT-signed, HTTPOnly, 5min TTL
```

**Ganho esperado:** elimina 150-400ms de cada navegação no dashboard.

**Variável de ambiente necessária:**
```bash
# Já existe no Supabase — Settings > API > JWT Secret
SUPABASE_JWT_SECRET=seu_jwt_secret_aqui
```

---

### 4.2 Fix B — Navegação client-side no Livechat (Fase 5)

**Problema:** cada clique em uma conversa chama `router.push()`, dispara SSR
completo com 5 queries paralelas (~1-2s).  
**Solução:** estado da conversa selecionada vira client-side puro.

**Arquitetura:**

```
ANTES:
  Clique → router.push('/livechat?conversation=id')
         → SSR page.tsx → 5 queries → re-render completo

DEPOIS:
  Clique → handleConversationClick(id)
         → setSelectedConvId(id)
         → fetchAndCache(messages) se não em cache
         → window.history.pushState (sem SSR)
         → render instantâneo com dados em cache
```

**Arquivos:**

#### `app/(dashboard)/livechat/page.tsx`

```typescript
// Remover: 3 queries de conversas no SSR (active, closed, important)
// Manter:  apenas tags + tab counts + mensagens da conversa inicial
// Motivo:  lista de conversas é mantida pelo Realtime client-side

export default async function LivechatPage({ searchParams }) {
  const { tenantId, neurocoreId } = await getAuthContext()

  const [allTagsResult, tabCountsResult] = await Promise.all([
    getAllTags(neurocoreId, tenantId),
    getLivechatTabStatusCounts(tenantId),
  ])

  const selectedConversationId = (await searchParams).conversation
  const initialMessages = selectedConversationId
    ? await getMessages(selectedConversationId).catch(() => [])
    : null

  return (
    <LivechatContent
      tenantId={tenantId}
      initialSelectedConversationId={selectedConversationId}
      initialMessages={initialMessages}
      allTags={allTagsResult}
      tabStatusCounts={tabCountsResult}
    />
  )
}
```

#### `components/livechat/livechat-content.tsx`

```typescript
// handleConversationClick — sem router.push
const handleConversationClick = useCallback(async (convId: string) => {
  if (convId === selectedConvId) return

  setSelectedConvId(convId)
  setIsLoadingMessages(true)

  // Atualiza URL sem SSR
  window.history.pushState({}, '', `/livechat?conversation=${convId}`)

  const msgs = await fetchAndCache(convId)
  setCurrentMessages(msgs)
  setIsLoadingMessages(false)
}, [selectedConvId, fetchAndCache])
```

**Ganho esperado:** troca de conversa cai de 1-2s para 150-300ms.  
**Primeira abertura** (sem cache): ~200-400ms (1 API call para mensagens).  
**Aperturas subsequentes** (cache hit de 30s): ~0ms instantâneo.

---

### 4.3 Fix C — Diagnóstico e proxy WebSocket para Realtime

**Passo 1 — Diagnóstico (antes de implementar qualquer coisa):**

Abrir DevTools → Network → filtrar por `WS`. Verificar endpoint:
- `wss://[projeto].supabase.co` → conexão direta (potencialmente bloqueada)
- `wss://[domínio próprio]/realtime` → já está proxy (OK)

**Passo 2 — Se conexão for direta, adicionar proxy Go:**

```go
// livia-gateway/handlers/ws_proxy.go
package handlers

import (
    "net/http"
    "net/url"
    "github.com/gorilla/websocket"
)

var supabaseRealtimeURL = os.Getenv("SUPABASE_REALTIME_WS_URL")
// ex: wss://xyz.supabase.co/realtime/v1

func WSProxyHandler(w http.ResponseWriter, r *http.Request) {
    // 1. Upgrade conexão do cliente
    clientConn, err := upgrader.Upgrade(w, r, nil)
    if err != nil { return }
    defer clientConn.Close()

    // 2. Conecta ao Supabase Realtime
    targetURL, _ := url.Parse(supabaseRealtimeURL)
    targetURL.RawQuery = r.URL.RawQuery // repassa params (apikey, vsn, etc.)

    serverConn, _, err := websocket.DefaultDialer.Dial(targetURL.String(), forwardHeaders(r))
    if err != nil { return }
    defer serverConn.Close()

    // 3. Proxy bidirecional
    go pipe(clientConn, serverConn)
    pipe(serverConn, clientConn)
}
```

**Passo 3 — Configurar cliente Supabase para usar proxy:**

```typescript
// lib/supabase/client.ts
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        // Aponta para Go proxy em vez de Supabase diretamente
        // Apenas necessário se ISP bloquear conexão direta
        endpoint: process.env.NEXT_PUBLIC_REALTIME_PROXY_URL
          ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1`,
      }
    }
  )
}
```

```bash
# .env.local (adicionar se usando proxy)
NEXT_PUBLIC_REALTIME_PROXY_URL=wss://gateway.seudominio.com.br/realtime
```

---

### 4.4 Checklist Fase 0

```
[x] Fix A: instalar jose (npm install jose)                                  ← 2026-04-21
[x] Fix A: refatorar middleware — getSession() + jwtVerify() com JWKS        ← 2026-04-21
[x] Fix A: cookie x-user-ctx (tenant_id, role, modules, terms) TTL 5 min    ← 2026-04-21
[x] Fix B: remover queries closed/important do SSR do page.tsx           ← 2026-04-20
[x] Fix B: adicionar lazy loading da aba Encerradas no ContactList       ← 2026-04-20
[x] Fix B: novo API route GET /api/livechat/conversations?filter=closed  ← 2026-04-20
[x] Fix B: handleConversationClick já usa history.pushState (existia)    ← já implementado
[x] Fix C: diagnosticar endpoint WS no DevTools                              ← 2026-04-21
[ ] Fix C: implementar WS proxy Go (se reportado por usuários em ISP restritivo)
[ ] Fix C: configurar NEXT_PUBLIC_REALTIME_PROXY_URL (se necessário)
[x] Fix D: cache L1/L2/L3 + prefetch batched de 100 conversas            ← 2026-04-20
[x] Fix E: LIVECHAT_INITIAL_CONVERSATIONS_LIMIT 10.000 → 300             ← 2026-04-21
[x] Fix E: virtualização da lista com @tanstack/react-virtual             ← 2026-04-21
[ ] Validar: medir tempo de carregamento inicial antes e depois
```

### 4.5 Status Fase 0

| Fix | Status | Data | Resultado |
|---|---|---|---|
| Fix A — Middleware JWT local | ✅ Implementado | 2026-04-21 | getUser() substituído por getSession()+jwtVerify(JWKS); cookie x-user-ctx elimina query ao banco em ~99% dos requests |
| Fix B — Lazy loading encerradas + SSR enxuto | ✅ Implementado | 2026-04-20 | SSR faz 3 queries (era 5); encerradas carregam sob demanda |
| Fix C — Diagnóstico WebSocket | ✅ Diagnosticado | 2026-04-21 | Kaspersky proxia todas as WS — sem bloqueio de ISP no ambiente; proxy Go fica pendente até relato de usuários em ISP restritivo |
| Fix D — Cache L1/L2/L3 + prefetch batched | ✅ Implementado | 2026-04-20 | Cliques em conversas já prefetchadas são instantâneos; persiste entre F5 |
| Fix E — Limite SSR + virtualização da lista | ✅ Implementado | 2026-04-21 | SSR serializa 300 registros (era 10k); DOM mantém ~15 nós independente do volume |

**Arquivos alterados no Fix B:**
- `app/(dashboard)/livechat/page.tsx` — remove `closedConvsResult`, `importantConvsResult` e lógica de merge
- `components/livechat/contact-list.tsx` — lazy load com fetch ao clicar em "Encerradas", estados de loading/error/retry
- `app/api/livechat/conversations/route.ts` — novo endpoint `GET ?filter=closed&limit=300`

**Arquivos alterados no Fix D:**
- `lib/hooks/use-messages-cache.ts` — L1 memory 5 min, L2 localStorage 30 min (últimas 30 msgs), `prefetchConversationsBatched` com lotes de 5 / 300 ms delay / abort support
- `components/livechat/livechat-content.tsx` — prefetch de até 100 conversas priorizando manuais (ia_active=false), cleanup via abort no unmount

**Arquivos alterados no Fix E:**
- `config/constants.ts` — `LIVECHAT_INITIAL_CONVERSATIONS_LIMIT` 10.000 → 300; comentário atualizado explicando que contadores vêm da RPC (sem limite)
- `components/livechat/contact-list.tsx` — virtualização com `@tanstack/react-virtual`; renderiza ~15 itens visíveis em vez de todos; `measureElement` auto-ajusta altura; todas as features mantidas (lazy load, busca, muted, importantes, hover prefetch)

---

## 5. Fase 1 — Modularização do Código

**Objetivo:** separar o livechat em módulos por domínio antes de adicionar
novas features. Evitar que o monólito cresça mais.  
**Prazo estimado:** 1 semana  
**Natureza:** refactoring puro — zero mudança de comportamento

---

### 5.1 Nova estrutura de pastas

```
app/(dashboard)/
  inbox/                    ← renomear de livechat/
    page.tsx
    error.tsx
  contacts/                 ← expandir (hoje é rudimentar)
    page.tsx
    [id]/
      page.tsx
  channels/                 ← renomear de configuracoes/conexoes/
    page.tsx
    logs/                   ← novo (Fase 4)
      page.tsx
  automation/               ← novo (Fase 3)
    page.tsx                ← configuração de URA rules
  reports/                  ← novo (Fase 5)
    page.tsx

components/
  inbox/                    ← renomear de livechat/
  channels/                 ← componentes de canais/conexões
  contacts/                 ← componentes de contatos/CRM
  shared/                   ← componentes reutilizáveis entre módulos
    tag-badge.tsx
    audio-player.tsx
    typing-indicator.tsx
    (outros componentes genéricos)

lib/
  hooks/
    inbox/                  ← hooks específicos do inbox
    channels/               ← hooks de canais
    shared/                 ← hooks reutilizáveis
  queries/
    inbox.ts                ← renomear de livechat.ts
    contacts.ts
    channels.ts
```

### 5.2 Regra de co-localização

- Componente usado em apenas um módulo → pasta do módulo
- Componente usado em 2+ módulos → `components/shared/`
- Hook que faz query Supabase → `lib/queries/[módulo].ts`
- Hook que gerencia estado/realtime → `lib/hooks/[módulo]/`

### 5.3 Checklist Fase 1

```
[ ] Criar alias @/inbox → components/inbox no tsconfig       ← não necessário (@/* já cobre)
[x] Renomear components/livechat → components/inbox          ← 2026-04-21
[x] Renomear lib/queries/livechat.ts → lib/queries/inbox.ts  ← 2026-04-21
[x] Atualizar todos os imports (codemod ou find-replace)      ← 2026-04-21
[x] Mover componentes genéricos para components/shared/       ← 2026-04-21 (tag-badge)
[x] Atualizar middleware.ts (nova rota /inbox)                 ← 2026-04-21
[x] Atualizar referências de /livechat → /inbox nas rotas     ← 2026-04-21
[x] Testar que nada quebrou (npm run build)                    ← 2026-04-21
```

### 5.4 Status Fase 1

| Passo | Status | Data | Detalhe |
|---|---|---|---|
| 1a — Renomear components/livechat + lib/queries/livechat | ✅ Concluído | 2026-04-21 | 41 arquivos renomeados via `git mv`; tag-badge extraído para `components/shared/` |
| 1b — Renomear rota /livechat → /inbox | ✅ Concluído | 2026-04-21 | Redirect 301 em `next.config.ts`; 28 arquivos atualizados; middleware, permissions, nav, auth/onboarding, e2e |

**Arquivos alterados no Passo 1a:**
- `components/livechat/` → `components/inbox/` (31 arquivos, git mv preserva histórico)
- `lib/queries/livechat.ts` → `lib/queries/inbox.ts`
- `components/livechat/tag-badge.tsx` → `components/shared/tag-badge.tsx`
- Imports atualizados em: `app/(dashboard)/livechat/page.tsx`, `components/tags/*`, `app/api/livechat/*`, `lib/repositories/*`

**Arquivos alterados no Passo 1b:**
- `next.config.ts` — redirect 301 `/livechat` e `/livechat/:path*` → `/inbox`
- `app/(dashboard)/inbox/` — rota movida de `livechat/`
- `middleware.ts` — `isDashboardRoute` e redirect de tenant: `/livechat` → `/inbox`
- `lib/permissions/index.ts` — padrão de rota `/inbox`
- `components/layout/*` — hrefs atualizados
- `app/(auth)/*`, `app/auth/callback/route.ts` — redirects pós-login atualizados
- `components/inbox/livechat-content.tsx`, `contact-list.tsx` — `history.pushState` URLs
- `components/crm/crm-conversation-card.tsx` — URL de deep link para conversa

---

## 6. Fase 2 — Go Message Gateway

**Objetivo:** criar o serviço Go que recebe webhooks dos canais, roteia e
persiste mensagens, substituindo o n8n nessa função.  
**Prazo estimado:** 3-4 semanas  
**Deploy:** VPS Hostinger (mesma VPN do n8n)  
**Repositório:** `livia-gateway` (novo repositório Go)

---

### 6.1 Estrutura do projeto Go

```
livia-gateway/
├── main.go
├── go.mod
├── go.sum
├── config/
│   └── config.go           # lê env vars, valida, expõe Config struct
├── handlers/
│   ├── evolution.go        # POST /webhook/evolution — recebe eventos Evolution
│   ├── meta.go             # POST /webhook/meta — recebe eventos Meta/WhatsApp Cloud
│   ├── outbound.go         # POST /send — recebe de Next.js para enviar a canal
│   ├── ws_proxy.go         # GET /realtime — proxy WebSocket → Supabase Realtime
│   └── health.go           # GET /health — healthcheck
├── gateway/
│   ├── normalizer.go       # converte payloads Evolution/Meta → MessageEvent padrão
│   ├── dedup.go            # LRU cache de message IDs externos (evita duplicatas)
│   └── persister.go        # grava MessageEvent no Supabase via REST API
├── ura/
│   ├── engine.go           # função central Route(ctx, msg) → RouteDecision
│   ├── strategies.go       # round_robin, least_busy, random, percentage, sticky
│   ├── rules_cache.go      # cache das ura_rules com TTL de 30s
│   └── dispatcher.go       # executa a ação da RouteDecision
├── integrations/
│   ├── supabase.go         # cliente HTTP para Supabase REST API
│   ├── n8n.go              # chama workflows n8n (apenas para rota IA)
│   ├── evolution.go        # envia mensagens via Evolution API
│   └── meta.go             # envia mensagens via Meta Cloud API
└── logger/
    └── logger.go           # structured logging (JSON) para logs de canal
```

### 6.2 Tipos centrais

```go
// gateway/normalizer.go

// MessageEvent: representação interna normalizada de qualquer mensagem recebida
type MessageEvent struct {
    ExternalID     string    // ID da mensagem no canal (Evolution, Meta, etc.)
    TenantID       string
    ChannelID      string    // UUID do canal no banco
    ContactPhone   string    // número do remetente
    Content        string
    MediaURL       string    // vazio se texto puro
    MediaType      string    // "image" | "audio" | "video" | "document" | ""
    IsFromMe       bool      // true se enviada pelo próprio número
    Timestamp      time.Time
    Provider       string    // "evolution" | "meta"
    RawPayload     []byte    // payload original (para logging/debugging)
}

// RouteDecision: saída do URA Engine
type RouteDecision struct {
    Type           string    // "human" | "ai" | "queue" | "auto_reply" | "ignore"
    AttendantID    string    // UUID do atendente (human ou ai)
    TeamID         string    // UUID do time (se route=team)
    WorkflowID     string    // path do webhook n8n (se type=ai)
    AutoReplyMsg   string    // mensagem automática (se type=auto_reply)
    ConversationID string    // preenchido pelo persister antes do routing
}
```

### 6.3 Fluxo de processamento

```go
// main.go — fluxo principal para mensagem recebida
func processIncomingMessage(ctx context.Context, event *MessageEvent) error {
    // 1. Deduplicação
    if dedup.IsSeen(event.ExternalID) {
        return nil // mensagem duplicada, ignora silenciosamente
    }
    dedup.Mark(event.ExternalID)

    // 2. Ignorar mensagens enviadas pelo próprio número (echo)
    if event.IsFromMe {
        return nil
    }

    // 3. Persistir mensagem no Supabase
    convID, err := persister.PersistMessage(ctx, event)
    if err != nil {
        return fmt.Errorf("persist: %w", err)
    }
    event.ConversationID = convID

    // 4. Logar evento de mensagem recebida
    channelLogger.Log(ctx, ChannelLogEvent{
        TenantID:  event.TenantID,
        ChannelID: event.ChannelID,
        EventType: "message_received",
        EventData: map[string]any{"message_id": event.ExternalID},
    })

    // 5. URA Engine decide rota
    decision, err := uraEngine.Route(ctx, event)
    if err != nil {
        return fmt.Errorf("ura route: %w", err)
    }

    // 6. Executar decisão
    return dispatcher.Execute(ctx, event, decision)
}
```

### 6.4 URA Engine — função central

```go
// ura/engine.go

func (e *Engine) Route(ctx context.Context, event *MessageEvent) (*RouteDecision, error) {
    // Busca configuração do tenant (cache 60s)
    config, err := e.getConfig(ctx, event.TenantID)
    if err != nil {
        return fallbackDecision(), nil // nunca bloqueia por erro de config
    }

    // Modo Intent Agent: tudo vai para IA
    if config.Mode == "intent_agent" {
        return &RouteDecision{
            Type:       "ai",
            WorkflowID: config.DefaultAIWorkflowID,
        }, nil
    }

    // Modo Direto: tudo vai para fila
    if config.Mode == "direct" {
        return &RouteDecision{Type: "queue"}, nil
    }

    // Conversa existente com atribuição ativa → sticky (não re-roteia)
    if assignment := e.getActiveAssignment(ctx, event.ConversationID); assignment != nil {
        return &RouteDecision{
            Type:        assignment.AttendantType,
            AttendantID: assignment.AttendantID,
        }, nil
    }

    // Avalia regras URA em ordem de prioridade (menor priority = avaliado primeiro)
    rules, _ := e.getRules(ctx, event.TenantID) // cached 30s
    for _, rule := range rules {
        if !rule.IsActive {
            continue
        }
        if rule.Matches(event) {
            return e.dispatcher.BuildDecision(ctx, rule, event)
        }
    }

    // Fallback: fila geral
    return &RouteDecision{Type: "queue"}, nil
}
```

### 6.5 Estratégias de distribuição

```go
// ura/strategies.go

type Strategy interface {
    SelectAttendant(ctx context.Context, pool []Attendant, event *MessageEvent) (*Attendant, error)
}

// RoundRobin: distribui em sequência circular
type RoundRobinStrategy struct {
    counters sync.Map // tenant+team → current index
}

// LeastBusy: agente com menos conversas abertas
type LeastBusyStrategy struct{}

// Random: sorteia aleatoriamente entre disponíveis
type RandomStrategy struct{}

// Percentage: divide tráfego proporcionalmente entre times
// Ex: { "team_a": 70, "team_b": 30 }
type PercentageStrategy struct {
    Buckets []PercentageBucket
}

// SkillMatch: filtra agentes com habilidade requerida, aplica LeastBusy nos filtrados
type SkillMatchStrategy struct {
    RequiredSkill string
}

// Sticky: retorna o agente da última conversa do contato
type StickyStrategy struct{}
```

### 6.6 Migração do fluxo de entrada (sem big bang)

A migração é feita em 3 passos sem downtime:

```
Passo 1: Go Gateway recebe webhook e apenas loga (sem rotear)
  → Aponta uma instância Evolution para o Go Gateway
  → Valida que mensagens chegam e são logadas corretamente
  → n8n ainda recebe o mesmo webhook em paralelo

Passo 2: Go Gateway persiste mensagens diretamente no Supabase
  → Compara com o que o n8n gravaria (deve ser idêntico)
  → n8n ainda ativo como fallback

Passo 3: Go Gateway assume totalmente, n8n sai do caminho de entrada
  → Todas as instâncias migradas
  → n8n configurado para receber APENAS eventos de IA (via Go)
```

### 6.7 Variáveis de ambiente do Go Gateway

```bash
# Supabase
SUPABASE_URL=https://[projeto].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # para escrita sem RLS

# Canais
EVOLUTION_API_URL=https://wsapilocal2.ligeira.net
EVOLUTION_API_KEY=xTTX8udaV3w2EdsV41duwbART
EVOLUTION_WEBHOOK_SECRET=ad8a28b4...

META_WEBHOOK_VERIFY_TOKEN=...
META_APP_SECRET=...

# n8n (apenas para rota IA)
N8N_BASE_URL=https://acesse.ligeiratelecom.com.br
N8N_AI_WEBHOOK_PATH=/webhook/ai-attendant

# Realtime proxy
SUPABASE_REALTIME_WS_URL=wss://[projeto].supabase.co/realtime/v1

# Server
PORT=8080
LOG_LEVEL=info
DEDUP_WINDOW_SECONDS=60     # janela de deduplicação
RULES_CACHE_TTL_SECONDS=30  # cache das regras URA
```

### 6.8 Checklist Fase 2

```
[x] Criar repositório livia-gateway                                          ← 2026-04-21
[x] Implementar config/config.go                                             ← 2026-04-21/22/23
    → PORT, LOG_LEVEL, SHADOW_MODE, N8N_WEBHOOK_URL, GATEWAY_API_KEY
    → adicionado: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DUAL_WRITE       ← 2026-04-23
[x] Analisar workflows n8n First Integrator + Master Integrator              ← 2026-04-23
    → mapeamento completo: tabelas, campos, RPC, JID handling, is_muted
[x] Criar RPC Supabase: upsert_contact_conversation                          ← 2026-04-23
    → arquivo: supabase/migrations/20260423_upsert_contact_conversation_rpc.sql
    → ATENÇÃO: confirmar que foi aplicada no Supabase SQL Editor
[x] Implementar gateway/normalizer.go                                        ← 2026-04-23
[x] Implementar gateway/dedup.go (TTL 5min, gcLoop)                         ← 2026-04-23
[x] Implementar integrations/supabase.go (REST client)                      ← 2026-04-23
[x] Implementar gateway/persister.go                                         ← 2026-04-23
    → channel lookup → upsert C&C → is_muted check → insert message
[x] Atualizar handlers/evolution.go (dual-write + goroutine persist)        ← 2026-04-23
[x] Atualizar main.go (injeção Persister + Dedup)                           ← 2026-04-23
[x] Implementar handlers/evolution.go (shadow mode + forward para n8n)       ← 2026-04-21
[x] Implementar handlers/outbound.go (POST /send → Evolution API direta)     ← 2026-04-22
[ ] Implementar handlers/ws_proxy.go (WebSocket proxy)
[x] Implementar handlers/health.go                                            ← 2026-04-21
[x] Deploy na VPS Hostinger (Docker Swarm + Traefik)                         ← 2026-04-21
[x] Fix banco Evolution (evolution_user + stack yaml corrigido)               ← 2026-04-22
[x] Migração Passo 1: instância livia-test + Signum criadas com webhook → gateway  ← 2026-04-22
[x] Validação parcial gateway (inbound + outbound via IA confirmados)         ← 2026-04-22
[x] Atualizar Next.js: envio manual Evolution → Go Gateway (não n8n)         ← 2026-04-22
[x] Rebuild imagem Docker + redeploy stack em DUAL_WRITE=true                ← 2026-04-23
    → gateway rodando: "DUAL WRITE (Go persiste + forward → n8n em paralelo)"
[~] Validar dual-write com mensagem real (próximo passo imediato)
[ ] Validação dual-write: 24h comparando writes Go vs n8n (devem ser idênticos)
[ ] Cutover Passo 2: DUAL_WRITE=false SHADOW_MODE=false (Go assume inbound)
[ ] Implementar ura/ (engine + strategies)
[ ] Migração Passo 3: Go assume todas as instâncias
[ ] Implementar integrations/n8n.go (para rota AI)
[ ] [BACKLOG] contacts.is_blocked: hard block por tenant (drop no gateway antes de write)
```

### 6.9 Status Fase 2 — Validação Parcial do Gateway

#### ✅ Passo 1 Concluído — 2026-04-22

| Item | Status | Detalhe |
|---|---|---|
| Repositório `livia-gateway` criado | ✅ | https://github.com/FrankMarcelino/livia-gateway |
| Estrutura Go inicial | ✅ | `config/`, `handlers/`, `logger/`, `main.go` |
| Shadow mode com forward para n8n | ✅ | Gateway recebe → faz forward para n8n → loga → retorna 200 |
| Dockerfile (multi-stage, Alpine) | ✅ | Imagem final ~24MB |
| `stack.yaml` para Docker Swarm + Traefik | ✅ | Deploy via `docker stack deploy` |
| DNS `livia-gw.online24por7.ai` | ✅ | CNAME → manager01.online24por7.ai |
| Stack deployada no Swarm | ✅ | `livia-gateway_app` 1/1 replica rodando |
| HTTPS via Traefik + Let's Encrypt | ✅ | `https://livia-gw.online24por7.ai/health` respondendo |
| Fix banco Evolution (`evolution_user`) | ✅ | DB `evolution` em `livia_postgres` com usuário dedicado |
| Nova Evolution (`livia.wsapi.online24por7.ai`) | ✅ | Deployada, instâncias respondendo |
| Instância `Signum - 11 9 3618 8134` conectada | ✅ | Criada via LIVIA UI, status `open` |
| Webhook instâncias → gateway | ✅ | `POST /webhook/evolution` recebendo |
| Forward gateway → n8n | ✅ | `n8n_forward_ok:true` em todos os eventos |
| **Inbound** (mensagens recebidas) | ✅ **Validado** | `messages.upsert` chega no gateway e n8n processa |
| **Outbound IA** (agente IA envia) | ✅ **Validado** | n8n chama Evolution diretamente — funciona |
| **Outbound manual** (atendente envia) | ✅ **Implementado** | Next.js → Gateway `/send` → Evolution API |

#### Fluxo atual validado

```
INBOUND:
  WhatsApp → Evolution (nova) → livia-gateway (shadow) → n8n (forward) → Supabase
                                                         ↑
                                                  loga + n8n_forward_ok:true

OUTBOUND IA:
  n8n workflow → Evolution API direta (sem gateway) → WhatsApp  ✅

OUTBOUND MANUAL (Evolution):
  Frontend → Next.js /api/n8n/send-message → Gateway POST /send → Evolution → WhatsApp
  (Meta ainda vai via n8n — sem mudança)
```

#### Correções realizadas em 2026-04-22

1. **Fix banco Evolution** — `evolution_user` dedicado em `livia_postgres`, stack yaml corrigido
2. **Fix webhook URL** — gateway estava apontando para `livia-wh.online24por7.ai` (n8n vazio); corrigido para `acesse.ligeiratelecom.com.br` (n8n produção)
3. **Fix `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES`** — evolution_v2 stack: `false→true` para popular campo `apikey` no payload do webhook
4. **Multi-instance Evolution** — LIVIA UI + API routes refatoradas para suportar credenciais por canal (`config_json.evolution_api_url/key`)
5. **Outbound handler** — `handlers/outbound.go` no gateway; Next.js roteia Evolution → gateway, Meta → n8n
6. **UX otimista + estabilidade do balão** — mensagem aparece como `sent` imediatamente; envio real ocorre em `after()` sem bloquear a resposta HTTP; corrigido resize/dupla animação do balão; timeout do gateway: 15s → 30s sem falso `failed` em AbortError (ver detalhes abaixo)

#### Detalhes: UX otimista e estabilidade do balão (2026-04-22)

**Fluxo de envio manual (estado atual):**
```
1. Usuário digita → mensagem aparece na UI imediatamente (status=sent, id=temp-xxx)
2. POST /api/n8n/send-message → INSERT no Supabase (status='sent') → retorna {id, status} em ~150ms
3. after() → sendViaGateway (Evolution) ou sendToN8nAsync (Meta) em background
4. Se falha real → UPDATE messages SET status='failed' → Realtime traz para UI
5. Se timeout (30s) → mantém status='sent' (não gera falso failed)
```

**Stable key (balão não reanima):**
- `useRealtimeMessages` mantém um `stableKeyMapRef` que mapeia `message.id → chave de renderização`
- Quando temp é confirmado (temp-xxx → real-uuid), a chave de renderização permanece `temp-xxx`
- React não desmonta/remonta o componente → animação `slide-in-from-bottom` toca apenas uma vez

**Layout do reply button:**
- Botão de reply sempre presente no DOM (evita layout shift quando id muda de temp → real)
- `opacity-0 pointer-events-none` para mensagens em voo; visível apenas no hover após confirmação

#### Decisão de arquitetura: semântica de status (padrão de mercado)

Após análise, confirmamos que o padrão adotado é o mesmo do WhatsApp/Telegram e **não deve ser alterado**:

| status | external_message_id | Significado | Ícone |
|--------|-------------------|-------------|-------|
| `sent` | nulo | ✓ LIVIA recebeu e salvou | Check simples |
| `sent` | preenchido | ✓✓ Canal confirmou entrega | CheckCheck |
| `read` | qualquer | ✓✓ Destinatário leu | CheckCheck azul |
| `failed` | nulo | ✗ Falha confirmada | AlertCircle |

O status `'sent'` significa **"servidor recebeu"**, não **"WhatsApp entregou"**. O clock/pending só faria sentido em caso de falha de rede do lado do cliente — situação que não ocorre porque o INSERT no Supabase é síncrono e a resposta HTTP confirma a persistência.

**Ponto de atenção (baixa prioridade):** mensagens com `status='sent'` e `external_message_id` nulo após ~60s são potencialmente órfãs (after() falhou silenciosamente). Isso é muito raro em Vercel e será resolvido naturalmente no Passo 2, quando o Go Gateway passa a preencher o `external_message_id` diretamente com muito mais confiabilidade.

#### Próximos passos

1. ✅ Vars Vercel adicionadas (`GATEWAY_SEND_URL`, `GATEWAY_API_KEY`) — redeploy feito
2. ✅ Envio manual testado e funcionando via gateway
3. ✅ UX otimista com stable key + timeout robusto implementados
4. ✅ Semântica de status documentada e comentários do route.ts corrigidos
5. **Migração Passo 2** — Go persiste mensagens diretamente (sem n8n no inbound)

#### ✅ Análise n8n concluída — 2026-04-23

Os workflows n8n `First Integrator` e `Master Integrator` foram analisados completamente.
O mapa de tabelas/campos necessários para o Passo 2 está documentado na Seção 6.10.

#### ✅ Implementação Passo 2 concluída — 2026-04-23

Todos os arquivos Go do Passo 2 foram escritos, compilados e deployados:

| Arquivo | Status |
|---|---|
| `supabase/migrations/20260423_upsert_contact_conversation_rpc.sql` | ✅ Criado — **confirmar aplicação no Supabase** |
| `gateway/normalizer.go` | ✅ Implementado |
| `gateway/dedup.go` | ✅ Implementado |
| `integrations/supabase.go` | ✅ Implementado |
| `gateway/persister.go` | ✅ Implementado |
| `config/config.go` | ✅ Atualizado (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DUAL_WRITE) |
| `handlers/evolution.go` | ✅ Atualizado (dual-write + goroutine persist) |
| `main.go` | ✅ Atualizado (injeta Persister + Dedup) |
| `/root/stacks/livia-gateway.yaml` | ✅ Atualizado (DUAL_WRITE=true + credenciais Supabase) |
| Imagem Docker + redeploy | ✅ Gateway rodando em DUAL WRITE |

**Estado atual do gateway (VPS):**
```
"mode":"DUAL WRITE (Go persiste + forward → n8n em paralelo)"
```

#### ⏸️ PONTO DE RETOMADA — Validação Dual-Write

**Pré-requisito crítico:**
```
Confirmar que a RPC upsert_contact_conversation foi aplicada no Supabase SQL Editor.
Arquivo: supabase/migrations/20260423_upsert_contact_conversation_rpc.sql
Verificar: SELECT proname FROM pg_proc WHERE proname = 'upsert_contact_conversation';
```

**Próximos passos em ordem:**

1. **Testar com mensagem real** — enviar WhatsApp para instância Signum e verificar logs:
   ```bash
   ssh vps-livia "docker service logs livia-gateway_app -f 2>&1"
   ```
   Esperado no log:
   ```json
   {"msg":"persister: mensagem persistida","external_id":"...","conversation_id":"..."}
   ```

2. **Se `persist falhou: channel lookup`** — verificar se o `apikey` está chegando no payload:
   - O campo `body.apikey` precisa estar populado na Evolution
   - Confirmar que `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true` no stack da Evolution

3. **Se `persist falhou: upsert contact/conv`** — RPC não foi aplicada no Supabase ainda

4. **Validação 24h** — após primeiro persist bem-sucedido, deixar rodar 24h e comparar:
   - Contagem de mensagens gravadas pelo Go vs pelo n8n para o mesmo período
   - Verificar `external_message_id` populado corretamente
   - Verificar `conversation_id` correto (mesma conversa que o n8n usaria)

5. **Cutover** — após validação OK:
   ```yaml
   # /root/stacks/livia-gateway.yaml
   - DUAL_WRITE=false   # para de fazer forward para n8n
   - SHADOW_MODE=false  # já estava false
   ```
   ```bash
   docker stack deploy -c /root/stacks/livia-gateway.yaml livia-gateway
   ```

**Rollback sempre disponível** (< 60s):
```bash
# Trocar para SHADOW_MODE=true + DUAL_WRITE=false no stack e redeploy
# OU trocar webhook da Evolution de volta para n8n direto
```

**Rollback sempre disponível:** trocar webhook Evolution de volta para n8n direto em < 60s

**Rollback inbound (se necessário):**
```bash
# Trocar webhook da instância de volta para n8n direto
curl -s -X POST https://livia.wsapi.online24por7.ai/webhook/set/Signum%20-%2011%209%203618%208134 \
  -H "apikey: 29eb9af8-0aa5-4352-9e54-96b0f2a0e545" \
  -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"https://acesse.ligeiratelecom.com.br/webhook/dev_first_integrator_001_dev","byEvents":false,"base64":true,"events":["MESSAGES_UPSERT","CONNECTION_UPDATE"]}}'
```

---

### 6.10 Passo 2 — Blueprint Técnico

> Resultado da análise dos workflows n8n First Integrator + Master Integrator (2026-04-23).
> Este é o contrato exato que o Go Gateway deve replicar.

#### 6.10.1 Payload Evolution (MESSAGES_UPSERT) — campos relevantes

```json
{
  "event": "messages.upsert",
  "instance": "nome-da-instancia",
  "apikey": "chave-da-instancia",
  "data": {
    "key": {
      "remoteJid": "558896370021@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0123ABC456"
    },
    "pushName": "João Silva",
    "message": {
      "conversation": "Olá, tudo bem?"
    },
    "messageType": "conversation",
    "messageTimestamp": 1714000000,
    "remoteJidAlt": "558896370021@s.whatsapp.net"
  }
}
```

**Regras de extração:**
- `payload_type`: derivado de `event` — apenas `messages.upsert` com `fromMe=false` é processado
- `external_message_id`: `data.key.id`
- `logicalJid` (identificação do contato): preferir `data.remoteJidAlt` (@s.whatsapp.net) sobre `data.key.remoteJid` (pode ser LID @lid)
- `phone` para contato: strip do sufixo `@s.whatsapp.net` do `logicalJid`
- `channel_lookup_key`: `body.apikey` (não `body.instance`) — mesmo comportamento do Master Integrator
- `content`: `data.message.conversation` (texto) ou `data.message.extendedTextMessage.text`

#### 6.10.2 RPC de channel lookup

```sql
-- RPC existente: get_channel_evolution_by_instance_id(p_instance_name text)
-- Chamada: p_instance_name = body.apikey
-- Retorna: canal + tenant_id + channel_provider_identifier_code + api_base_config
-- Match por: config_json->>'instance_name' OR config_json->>'instance_id_api' (OR condition)
```

Resposta relevante para o Gateway:
- `id` → `channel_id`
- `tenant_id`
- `config_json` → dados da instância
- `channel_provider_identifier_code` → identifica o provider

#### 6.10.3 Fluxo completo do persister

```
1. Parse payload → identificar payload_type
   → só processa: event="messages.upsert" + fromMe=false
   → ignora: fromMe=true, connection.update, outros eventos

2. Dedup: IsSeen(external_message_id) → drop silencioso se duplicata

3. Channel lookup: RPC(p_instance_name = body.apikey) → {tenant_id, channel_id, ...}
   → erro 500 se canal não encontrado (não pode persistir sem tenant)

4. Upsert contact:
   → chave: (tenant_id, external_identification_contact=logicalJid)
   → campos: {name=pushName, phone=phoneStripped}
   → retorna: contact_id, is_muted

5. CHECK is_muted:
   → se is_muted=true: log "dropped: contact muted", return 200 OK (não grava mensagem)
   → se is_muted=false: continua

6. Upsert conversation:
   → chave: (contact_id, channel_id) WHERE status='open'
   → se existe: UPDATE last_message_at=now(), consecutive_reactivations=0
   → se não existe: INSERT {contact_id, channel_id, tenant_id, status='open',
                             ia_active=false SE is_muted=true (não aplica aqui — já dropou),
                             ia_active=<default_do_tenant>}
   → retorna: conversation_id

7. Insert message:
   → tabela: messages
   → campos: {
       conversation_id,
       sender_type: "customer",
       content: extractContent(payload),
       external_message_id: data.key.id,
       tenant_id,
       created_at: from messageTimestamp
     }

8. Log: channel_connection_log (event_type="message_received")
```

#### 6.10.4 RPC recomendada: upsert_contact_conversation

Para evitar race conditions e reduzir latência, criar uma RPC Supabase que execute os passos 4-6 em uma única transação:

```sql
CREATE OR REPLACE FUNCTION upsert_contact_conversation(
  p_tenant_id          uuid,
  p_channel_id         uuid,
  p_logical_jid        text,    -- external_identification_contact
  p_phone              text,
  p_name               text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_id   uuid;
  v_conv_id      uuid;
  v_is_muted     boolean;
  v_ia_active    boolean;
BEGIN
  -- Upsert contato
  INSERT INTO contacts (tenant_id, external_identification_contact, phone, name)
  VALUES (p_tenant_id, p_logical_jid, p_phone, p_name)
  ON CONFLICT (tenant_id, external_identification_contact)
  DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    name  = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name)
  RETURNING id, is_muted INTO v_contact_id, v_is_muted;

  -- Se muted: retorna imediatamente sem tocar em conversa
  IF v_is_muted THEN
    RETURN jsonb_build_object(
      'contact_id', v_contact_id,
      'conversation_id', null,
      'is_muted', true
    );
  END IF;

  -- Upsert conversa aberta
  SELECT id INTO v_conv_id
  FROM conversations
  WHERE contact_id = v_contact_id
    AND channel_id = p_channel_id
    AND status = 'open'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    UPDATE conversations SET
      last_message_at = now(),
      consecutive_reactivations = 0
    WHERE id = v_conv_id;
  ELSE
    -- Nova conversa: herda ia_active do padrão do tenant
    INSERT INTO conversations (tenant_id, contact_id, channel_id, status, last_message_at)
    VALUES (p_tenant_id, v_contact_id, p_channel_id, 'open', now())
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'conversation_id', v_conv_id,
    'is_muted', false
  );
END;
$$;
```

#### 6.10.5 Extração de conteúdo da mensagem

| messageType | Campo no payload | Tratamento |
|---|---|---|
| `conversation` | `data.message.conversation` | texto direto |
| `extendedTextMessage` | `data.message.extendedTextMessage.text` | texto com formatação |
| `imageMessage` | `data.message.imageMessage.caption` | legenda da imagem |
| `audioMessage` | — | chamar edge fn `upload-audio-message` → Supabase Storage |
| `documentMessage` | `data.message.documentMessage.title` | nome do documento |
| `stickerMessage` | — | conteúdo="[sticker]" |
| outros | — | conteúdo="[mensagem não suportada]" |

**Áudio no MVP:** chamar a edge function existente `upload-audio-message` (mesmo comportamento do n8n). Não reimplementar transcrição no Go.

#### 6.10.6 Dual-write — estratégia de validação

```
handlers/evolution.go (modo dual-write):
  1. Go persiste (goroutine, não bloqueia resposta)
  2. Forward para n8n (como hoje — síncrono para garantir n8n processa)
  3. 200 OK retornado imediatamente

Comparação manual (24h):
  - Contar mensagens gravadas pelo Go vs n8n para o mesmo período
  - Verificar campos: external_message_id, sender_type, conversation_id, content
  - Se divergência > 0: investigar antes de cutover

Cutover:
  - Desabilitar forward n8n no evolution.go (SHADOW_MODE=false + DUAL_WRITE=false)
  - n8n continua recebendo apenas rota de IA (disparado pelo URA Engine)
```

#### 6.10.7 is_muted — estado atual e gap

**O que já existe (implementado):**
- `contacts.is_muted` + `muted_at` + `muted_by` + `mute_reason` no banco
- Mute action: pausa `ia_active=false` em todas as conversas abertas do contato
- UI filtra conversas de contatos mutados (`!contacts.is_muted` em inbox query)
- Lista de silenciados com badge e botão de remover silêncio (reversível)
- Unmute não reactiva IA automaticamente — decisão explícita do atendente

**Gap identificado:**
- Se contato muted fecha conversa e reabre (nova mensagem) → nova conversa nasce com `ia_active` padrão → IA pode interceptar
- n8n não verifica `contacts.is_muted` antes de processar nova conversa

**Fix no Passo 2 (Go Gateway):**
- A RPC `upsert_contact_conversation` verifica `is_muted` antes de criar nova conversa
- Se `is_muted=true`: drop da mensagem (200 OK, sem write) — contato não recebe atenção de ninguém
- Comportamento consistente com o que a UI já mostra: contato mutado não aparece no inbox

#### 6.10.8 is_blocked — conceito e backlog

**Distinção clara:**

| | Soft Mute (`is_muted`) | Hard Block (`is_blocked`) |
|---|---|---|
| Mensagem entra no banco | Não (Go dropa no Passo 2) | Não |
| Visível para humanos | Não (filtrado no inbox) | Não |
| Ativa IA | Não | Não |
| Caso de uso | "Não quero atender agora" | Spam / abuso permanente |
| Reversível | Sim (UI) | Sim (UI) |
| Granularidade | Por contato + tenant | Por contato + tenant |

**Migration quando virar demanda:**
```sql
ALTER TABLE contacts
  ADD COLUMN is_blocked    boolean NOT NULL DEFAULT false,
  ADD COLUMN blocked_at    timestamptz,
  ADD COLUMN blocked_reason text;
```

**Gateway (quando implementado):**
```
channel lookup → upsert contact → CHECK is_blocked → drop (200 OK) se true
                                   ↓ se false
                               CHECK is_muted → drop se true
                                   ↓ se false
                               upsert conversation → insert message
```

**Status:** backlog — não implementar no Passo 2. O `is_muted` já cobre o caso de uso atual.

---

### 6.11 Estratégia de Integração Meta Cloud API (Decisão Arquitetural)

**Data da decisão:** 2026-04-23  
**Contexto:** a plataforma opera hoje com dois fluxos inbound paralelos:

```
Baileys (Signum)  → Evolution → livia-gateway → n8n   ← gateway assumindo
Meta Cloud API    → n8n diretamente                    ← fluxo paralelo, intacto
```

#### O que a Meta recomenda oficialmente

A Meta oferece dois caminhos legítimos para a Cloud API:

1. **Direto via Graph API** — App no Meta for Developers + WABA + webhooks no seu endpoint.  
2. **Via BSP certificado** — Business Solution Provider (Twilio, Infobip, Zenvia, Take Blip...) que a Meta endossa oficialmente.

**O que a Meta NÃO endossa:**
- Bibliotecas não-oficiais (Baileys, WPPConnect) — risco real de ban de conta
- Intermediários não-certificados como Evolution API (não é BSP)
- Automação via multidevice/Baileys em contas de produção

#### Evolution + Meta Cloud API: o que é na prática

Quando Evolution é configurado no modo "Cloud API", ele vira um **proxy/adaptador**:

```
Meta webhook → Evolution → seu sistema (formato Evolution normalizado)
Seu sistema  → Evolution → Meta Graph API (envio)
```

**Vantagens do proxy Evolution:**
- Formato único de payload — gateway trata Baileys e Cloud API igual
- Abstrai diferenças entre os dois tipos de conexão
- Centraliza envio via mesmo SDK

**Desvantagens do proxy Evolution:**
- Hop desnecessário para algo que já é oficial
- Evolution não é BSP — nenhuma certificação Meta
- Se Evolution cair, a instância Meta também cai
- Sem controle direto da conexão com a Meta
- Updates do Evolution podem quebrar a integração

#### Opções avaliadas

| Opção | Descrição | Decisão |
|-------|-----------|---------|
| **A** | Meta → n8n direto (atual) | Manter enquanto MVP |
| **B** | Meta → Evolution → livia-gateway | ❌ Rejeitado — intermediário desnecessário numa via já certificada |
| **C** | Meta → livia-gateway diretamente (handler nativo) | ✅ Alvo de médio prazo |

#### Decisão

**MVP:** manter Meta → n8n direto. Não mover, não quebrar.

**Médio prazo (pós-cutover Baileys):** implementar handler nativo `/webhook/meta` no gateway Go.
O payload da Meta Cloud API é bem documentado; o parser seria análogo ao `normalizer.go` da Evolution.
Isso elimina a dependência do Evolution para o fluxo oficial e segue a arquitetura que a Meta recomenda.

**Não usar Evolution como proxy para Meta oficial** — adiciona uma peça não-certificada
numa via que já é certificada, contra os princípios 12-factor de minimizar dependências.

#### Referências para implementação futura

- Webhook payload Meta: `entry[].changes[].value.messages[]`
- Verificação de webhook: header `X-Hub-Signature-256` (HMAC-SHA256 do App Secret)
- Envio: `POST /v18.0/{phone-number-id}/messages` com Bearer token do App
- Documentação: developers.facebook.com/docs/whatsapp/cloud-api

---

## 7. Fase 3 — Multi-Agente e URA Engine

**Objetivo:** adicionar suporte a múltiplos agentes com atribuição e configuração
de regras de roteamento via UI.  
**Prazo estimado:** 3-4 semanas  
**Depende de:** Fase 2 (Go Gateway)

---

### 7.1 Schema novo (migrations Supabase)

Ver Seção 10 para SQL completo. Resumo das tabelas:

| Tabela | Descrição |
|---|---|
| `teams` | Times/departamentos (Suporte, Vendas, etc.) |
| `team_members` | Membros de cada time com role e disponibilidade |
| `attendants` | Atendentes unificados: humanos + IA (mesma tabela) |
| `ura_configs` | Configuração de modo por tenant (ura / intent_agent / direct) |
| `ura_rules` | Regras de roteamento com condições e ações |
| `conversation_assignments` | Log de todas as atribuições (auditoria) |
| `conversation_queue` | Fila de conversas aguardando atribuição |

### 7.2 Mudanças na tabela `conversations`

```sql
ALTER TABLE conversations
  ADD COLUMN assigned_to uuid REFERENCES users(id),
  ADD COLUMN assigned_at timestamptz,
  ADD COLUMN team_id uuid REFERENCES teams(id);
```

### 7.3 Mudanças na UI

#### Filtros da inbox

```
HOJE:   [IA] [Manual] [Encerradas] [Importantes]
NOVO:   [Meus] [Não atribuídos] [Times ▼] [IA] [Encerradas] [Importantes]
```

- **Meus:** conversas com `assigned_to = user_id`
- **Não atribuídos:** `assigned_to IS NULL AND status = 'open'`
- **Times:** dropdown com times disponíveis do tenant

#### Header da conversa

```
HOJE:   [Nome do contato]              [⋮] [👤]
NOVO:   [Nome do contato]   [Agente: João ▼]  [⋮] [👤]
```

- Dropdown para reatribuir conversa para outro agente/time
- Agente atual sempre visível no header

#### Tela de configuração URA (`/automation`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Configuração de Atendimento                                     │
├──────────────────────┬──────────────────────────────────────────┤
│  Modo de operação    │  ● URA (múltiplos agentes)               │
│                      │  ○ Agente de IA (automático)             │
│                      │  ○ Direto (fila manual)                  │
├──────────────────────┴──────────────────────────────────────────┤
│  Regras de Roteamento                          [+ Nova Regra]   │
├─────┬──────────────────────────────┬──────────┬─────────────────┤
│  #  │  Condições                   │  Ação    │                 │
├─────┼──────────────────────────────┼──────────┼─────────────────┤
│  1  │  Tag: VIP                    │  → João  │  [editar][🗑️]  │
│  2  │  Palavra: "suporte"          │  → Time  │  [editar][🗑️]  │
│     │                              │  Suporte │                 │
│  3  │  Fora do horário comercial   │  → IA    │  [editar][🗑️]  │
│  4  │  (padrão)                    │  → RR    │  [editar][🗑️]  │
│     │                              │  Geral   │                 │
└─────┴──────────────────────────────┴──────────┴─────────────────┘
```

### 7.4 Tipos de condição suportados

| Tipo | Descrição | Exemplo de config |
|---|---|---|
| `channel_id` | Canal específico | `{ "channel_id": "uuid" }` |
| `contact_tag` | Contato tem tag | `{ "tag": "vip" }` |
| `first_message_keyword` | Primeira mensagem contém | `{ "keywords": ["suporte", "problema"] }` |
| `time_range` | Dentro de horário | `{ "from": "08:00", "to": "18:00", "tz": "America/Sao_Paulo" }` |
| `outside_hours` | Fora do horário comercial | usa `ura_configs.business_hours` |
| `contact_is_returning` | Contato já atendido antes | `{ "value": true }` |
| `conversation_count` | Número de conversas do contato | `{ "op": "gte", "value": 3 }` |

### 7.5 Tipos de ação suportados

| Ação | Estratégias disponíveis | Config |
|---|---|---|
| `assign_team` | round_robin, least_busy, random | `{ "team_id": "uuid", "strategy": "round_robin" }` |
| `assign_agent` | direto | `{ "agent_id": "uuid" }` |
| `assign_percentage` | múltiplos times com peso | `{ "buckets": [{"team_id":"A","pct":70},{"team_id":"B","pct":30}] }` |
| `route_ai` | agente IA | `{ "attendant_id": "uuid" }` |
| `queue` | fila de espera | `{ "target_team_id": "uuid" }` |
| `auto_reply` | resposta automática + fila | `{ "message": "Olá! Em breve retornamos." }` |

### 7.6 Checklist Fase 3

```
[ ] Migration: teams, team_members, attendants
[ ] Migration: ura_configs, ura_rules
[ ] Migration: conversation_assignments, conversation_queue
[ ] Migration: ALTER conversations ADD assigned_to, team_id
[ ] UI: filtros de inbox (Meus / Não atribuídos / Times)
[ ] UI: dropdown de atribuição no header da conversa
[ ] API: POST /api/conversations/assign (reatribuição manual)
[ ] UI: tela /automation (CRUD de regras URA)
[ ] UI: tela /teams (CRUD de times e membros)
[ ] Go: integrar URA Engine com regras do banco
[ ] Go: implementar todas as estratégias de distribuição
[ ] Go: implementar lógica sticky (retorna ao agente anterior)
[ ] Testar: conversa é atribuída corretamente pela regra
[ ] Testar: reatribuição manual atualiza via Realtime
[ ] Testar: agente vê apenas conversas atribuídas a ele/time
```

---

## 8. Fase 4 — Tela de Logs de Canal

**Objetivo:** visibilidade total sobre o estado de conexão dos canais,
para que problemas (QR expirado, instância desconectada, webhook falhando)
sejam detectados e diagnosticados sem precisar abrir o console da Evolution.  
**Prazo estimado:** 1 semana  
**Depende de:** Fase 2 (Go Gateway grava os logs)

---

### 8.1 Schema

```sql
CREATE TABLE channel_connection_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  channel_id  uuid REFERENCES channels(id),
  event_type  text NOT NULL,
  -- 'connected' | 'disconnected' | 'qr_generated' | 'qr_expired'
  -- 'message_received' | 'message_sent' | 'message_failed'
  -- 'webhook_received' | 'webhook_error' | 'reconnect_attempt'
  event_data  jsonb DEFAULT '{}',
  source      text NOT NULL,
  -- 'evolution' | 'meta' | 'go_gateway' | 'system'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON channel_connection_logs (channel_id, created_at DESC);
CREATE INDEX ON channel_connection_logs (tenant_id, created_at DESC);
CREATE INDEX ON channel_connection_logs (event_type, created_at DESC);

-- Supabase Realtime na tabela (atualização ao vivo na tela de logs)
ALTER TABLE channel_connection_logs REPLICA IDENTITY FULL;
```

### 8.2 Quem grava os logs

| Origem | Evento | Implementação |
|---|---|---|
| Go Gateway | message_received, message_failed, webhook_received, webhook_error | `logger/logger.go` |
| Go Gateway | connected, disconnected, qr_generated, reconnect_attempt | ao receber CONNECTION_UPDATE da Evolution |
| Next.js (existente) | connected, disconnected | `app/api/configuracoes/conexoes/webhook/route.ts` — adicionar insert |
| n8n | message_sent (confirmação de envio) | workflow existente — adicionar webhook para Go |

### 8.3 UI da tela de logs (`/channels/logs`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Logs de Conexão                [Filtrar canal ▼] [Filtrar ▼]   │
│                                               🔴 2 alertas      │
├──────────┬──────────────────┬─────────────────┬─────────────────┤
│ Horário  │ Canal            │ Evento          │ Detalhe         │
├──────────┼──────────────────┼─────────────────┼─────────────────┤
│ 14:32:01 │ WA Vendas        │ ✅ connected    │ Evolution       │
│ 14:31:55 │ WA Vendas        │ 🔄 qr_generated │ count: 2        │
│ 14:28:10 │ WA Suporte       │ ❌ disconnected │ Evolution       │
│ 14:27:50 │ WA Suporte       │ ⚠️ webhook_err  │ timeout 15s     │
│ 14:15:00 │ WA Vendas        │ 📨 msg_received │ +1 mensagem     │
└──────────┴──────────────────┴─────────────────┴─────────────────┘

[← Anterior]  Página 1 de 12  [Próxima →]     [Exportar CSV]
```

**Features:**
- Atualização ao vivo via Supabase Realtime (novo log aparece sem F5)
- Filtro por canal, tipo de evento e período
- Badge de alertas no ícone de canais na sidebar
- Expandir linha → ver `event_data` completo (JSON)

### 8.4 Badge de alerta na sidebar

```typescript
// Conta canais com status 'disconnected' no último evento
// Aparece como badge vermelho no ícone de Canais na sidebar
const { count } = await supabase
  .from('channels')
  .select('id', { count: 'exact' })
  .eq('tenant_id', tenantId)
  .eq('connection_status', 'disconnected')
  .eq('is_active', true)
```

### 8.5 Checklist Fase 4

```
[ ] Migration: channel_connection_logs (tabela + indexes + REPLICA IDENTITY)
[ ] Go Gateway: implementar logger/logger.go
[ ] Go Gateway: logar todos os eventos de webhook recebidos
[ ] Next.js webhook existente: adicionar insert ao channel_connection_logs
[ ] UI: /channels/logs (tabela paginada com Realtime)
[ ] UI: filtros por canal / evento / período
[ ] UI: badge de alerta na sidebar (canais desconectados)
[ ] UI: expandir linha → ver event_data JSON
[ ] UI: botão exportar CSV
```

---

## 9. Fase 5 — Evolução CRM

**Objetivo:** transformar o módulo de contatos em um CRM funcional com pipeline
de oportunidades, histórico unificado e métricas de atendimento.  
**Prazo estimado:** 4-6 semanas  
**Depende de:** Fase 3 (multi-agente ativo)

---

### 9.1 Módulo Contacts expandido

**Hoje:** contato tem nome, telefone, email, CPF, endereço — campos fixos.  
**Novo:** campos customizados por tenant + histórico unificado + score.

```sql
-- Campos customizados definidos pelo tenant
CREATE TABLE contact_field_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  field_key   text NOT NULL,     -- ex: "empresa", "cargo", "cnpj"
  field_label text NOT NULL,     -- ex: "Empresa", "Cargo"
  field_type  text NOT NULL,     -- "text" | "number" | "date" | "select" | "boolean"
  options     jsonb,             -- para type=select: ["opção1", "opção2"]
  is_required boolean DEFAULT false,
  display_order int DEFAULT 0,
  UNIQUE(tenant_id, field_key)
);

-- Valores dos campos para cada contato
CREATE TABLE contact_field_values (
  contact_id  uuid REFERENCES contacts(id),
  field_key   text NOT NULL,
  value       text,
  PRIMARY KEY (contact_id, field_key)
);

-- Notas internas sobre contatos
CREATE TABLE contact_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid REFERENCES contacts(id),
  tenant_id   uuid NOT NULL,
  content     text NOT NULL,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);
```

### 9.2 Pipeline de oportunidades

```sql
-- Estágios do pipeline (Kanban)
CREATE TABLE pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,  -- "Lead" | "Negociando" | "Proposta" | "Fechado" | "Perdido"
  color       text DEFAULT '#6366f1',
  display_order int NOT NULL DEFAULT 0,
  is_closed   boolean DEFAULT false,   -- estágio final
  is_won      boolean DEFAULT false,   -- fechado com sucesso
  created_at  timestamptz DEFAULT now()
);

-- Oportunidades (conversations podem ser vinculadas a deals)
ALTER TABLE conversations
  ADD COLUMN pipeline_stage_id uuid REFERENCES pipeline_stages(id),
  ADD COLUMN deal_value        numeric(12,2),
  ADD COLUMN deal_currency     text DEFAULT 'BRL',
  ADD COLUMN stage_moved_at    timestamptz;

-- Histórico de movimentações no pipeline
CREATE TABLE pipeline_stage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  from_stage_id   uuid REFERENCES pipeline_stages(id),
  to_stage_id     uuid REFERENCES pipeline_stages(id),
  moved_by        uuid REFERENCES users(id),
  moved_at        timestamptz DEFAULT now()
);
```

### 9.3 Métricas de atendimento

```sql
-- Snapshots diários de métricas (gerados por job Go ou n8n)
CREATE TABLE metrics_daily (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  date                  date NOT NULL,
  total_conversations   int DEFAULT 0,
  closed_conversations  int DEFAULT 0,
  ai_handled            int DEFAULT 0,     -- resolvidos só pela IA
  human_handled         int DEFAULT 0,     -- tiveram interação humana
  avg_first_response_s  int,               -- tempo médio de 1ª resposta em segundos
  avg_resolution_s      int,               -- tempo médio de resolução em segundos
  csat_positive         int DEFAULT 0,     -- feedback positivo
  csat_negative         int DEFAULT 0,     -- feedback negativo
  UNIQUE(tenant_id, date)
);
```

### 9.4 Telas novas

| Rota | Descrição |
|---|---|
| `/contacts` | Lista de contatos com busca, filtros e campos customizados |
| `/contacts/[id]` | Perfil completo: dados, histórico de conversas, notas, campos CRM |
| `/crm` | Kanban do pipeline com drag-and-drop entre estágios |
| `/reports` | Métricas: volume, tempo de resposta, CSAT, performance por agente |

### 9.5 Checklist Fase 5

```
[ ] Migration: contact_field_definitions + contact_field_values
[ ] Migration: contact_notes
[ ] Migration: pipeline_stages + ALTER conversations
[ ] Migration: pipeline_stage_history + metrics_daily
[ ] UI: /contacts — lista com campos customizados
[ ] UI: /contacts/[id] — perfil completo + histórico
[ ] UI: editor de campos customizados nas configurações
[ ] UI: /crm — Kanban (já existe base com use-crm-realtime.ts)
[ ] UI: drag-and-drop entre estágios + atualização via API
[ ] UI: /reports — gráficos de volume e tempo de resposta
[ ] Job: gerar metrics_daily (cron via n8n ou Go)
[ ] Integração: mover conversa no Kanban ↔ atualiza pipeline_stage_history
```

---

## 10. Schema de Banco Completo

SQL de todas as migrations novas organizadas por fase.

### Migration 001 — Performance (Fase 0)
_Não requer migration de schema — apenas mudanças de código._

### Migration 002 — Multi-agente base (Fase 3)

```sql
-- ============================================================
-- MIGRATION 002: Multi-agente + URA
-- ============================================================

-- Times/departamentos
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#6366f1',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON teams (tenant_id, is_active);

-- Membros de times
CREATE TABLE team_members (
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'agent',
  -- 'agent' | 'supervisor' | 'admin'
  skills        text[] DEFAULT '{}',
  is_available  boolean DEFAULT true,
  max_concurrent_conversations int DEFAULT 10,
  joined_at     timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Atendentes unificados (humano + IA)
CREATE TABLE attendants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  type          text NOT NULL,  -- 'human' | 'ai'

  -- Para type='human':
  user_id       uuid REFERENCES users(id),

  -- Para type='ai':
  ai_name       text,
  n8n_webhook_path text,

  -- Comum:
  team_id       uuid REFERENCES teams(id),
  skills        text[] DEFAULT '{}',
  max_concurrent int DEFAULT 10,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX ON attendants (tenant_id, type, is_active);

-- Configuração URA por tenant
CREATE TABLE ura_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL UNIQUE REFERENCES tenants(id),
  mode          text NOT NULL DEFAULT 'direct',
  -- 'ura' | 'intent_agent' | 'direct'
  default_ai_attendant_id uuid REFERENCES attendants(id),
  business_hours jsonb DEFAULT '{}',
  -- { "mon":{"from":"08:00","to":"18:00"}, "sat":null, "sun":null, ... }
  outside_hours_action text DEFAULT 'queue',
  -- 'queue' | 'ai' | 'auto_reply' | 'reject'
  outside_hours_message text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Regras URA
CREATE TABLE ura_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          text NOT NULL,
  priority      int NOT NULL DEFAULT 0,
  is_active     boolean DEFAULT true,
  conditions    jsonb NOT NULL DEFAULT '[]',
  -- [{"type":"channel_id","op":"eq","value":"uuid"},
  --  {"type":"contact_tag","op":"has","value":"vip"},
  --  {"type":"first_message_keyword","op":"contains_any","value":["suporte"]},
  --  {"type":"time_range","op":"within","value":{"from":"08:00","to":"18:00"}},
  --  {"type":"contact_is_returning","op":"eq","value":true}]
  action_type   text NOT NULL,
  -- 'assign_team' | 'assign_agent' | 'assign_percentage' | 'route_ai' | 'queue' | 'auto_reply'
  action_config jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX ON ura_rules (tenant_id, is_active, priority ASC);

-- Atribuições de conversa (histórico completo)
CREATE TABLE conversation_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  attendant_id    uuid REFERENCES attendants(id),
  team_id         uuid REFERENCES teams(id),
  assigned_by     uuid REFERENCES users(id),
  -- NULL = atribuído pelo URA Engine automaticamente
  assigned_at     timestamptz DEFAULT now(),
  unassigned_at   timestamptz,
  reason          text,
  -- 'ura_rule' | 'manual' | 'transfer' | 'overflow' | 'sticky'
  rule_id         uuid REFERENCES ura_rules(id)
);

CREATE INDEX ON conversation_assignments (conversation_id, assigned_at DESC);

-- Fila de espera
CREATE TABLE conversation_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  tenant_id       uuid NOT NULL,
  target_team_id  uuid REFERENCES teams(id),
  target_type     text DEFAULT 'any',
  -- 'human' | 'ai' | 'any'
  queued_at       timestamptz DEFAULT now(),
  auto_assign_at  timestamptz,
  -- quando fazer overflow automático
  is_active       boolean DEFAULT true
);

CREATE INDEX ON conversation_queue (tenant_id, is_active, queued_at ASC);

-- Novos campos em conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_to     uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at     timestamptz,
  ADD COLUMN IF NOT EXISTS team_id         uuid REFERENCES teams(id);

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to
  ON conversations (assigned_to) WHERE assigned_to IS NOT NULL;

-- Realtime
ALTER TABLE conversation_assignments REPLICA IDENTITY FULL;
ALTER TABLE conversation_queue REPLICA IDENTITY FULL;
```

### Migration 003 — Logs de canal (Fase 4)

```sql
-- ============================================================
-- MIGRATION 003: Channel Connection Logs
-- ============================================================

CREATE TABLE channel_connection_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  channel_id  uuid REFERENCES channels(id),
  event_type  text NOT NULL,
  event_data  jsonb DEFAULT '{}',
  source      text NOT NULL DEFAULT 'system',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON channel_connection_logs (channel_id, created_at DESC);
CREATE INDEX ON channel_connection_logs (tenant_id, created_at DESC);
CREATE INDEX ON channel_connection_logs (event_type, created_at DESC);

ALTER TABLE channel_connection_logs REPLICA IDENTITY FULL;
```

### Migration 004 — CRM (Fase 5)

```sql
-- ============================================================
-- MIGRATION 004: CRM — Campos customizados + Pipeline
-- ============================================================

CREATE TABLE contact_field_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  field_key     text NOT NULL,
  field_label   text NOT NULL,
  field_type    text NOT NULL DEFAULT 'text',
  options       jsonb,
  is_required   boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, field_key)
);

CREATE TABLE contact_field_values (
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_key   text NOT NULL,
  value       text,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (contact_id, field_key)
);

CREATE TABLE contact_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  content     text NOT NULL,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          text NOT NULL,
  color         text DEFAULT '#6366f1',
  display_order int NOT NULL DEFAULT 0,
  is_closed     boolean DEFAULT false,
  is_won        boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage_id  uuid REFERENCES pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS deal_value         numeric(12,2),
  ADD COLUMN IF NOT EXISTS deal_currency      text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS stage_moved_at     timestamptz;

CREATE TABLE pipeline_stage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  from_stage_id   uuid REFERENCES pipeline_stages(id),
  to_stage_id     uuid REFERENCES pipeline_stages(id),
  moved_by        uuid REFERENCES users(id),
  moved_at        timestamptz DEFAULT now()
);

CREATE TABLE metrics_daily (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  date                  date NOT NULL,
  total_conversations   int DEFAULT 0,
  closed_conversations  int DEFAULT 0,
  ai_handled            int DEFAULT 0,
  human_handled         int DEFAULT 0,
  avg_first_response_s  int,
  avg_resolution_s      int,
  csat_positive         int DEFAULT 0,
  csat_negative         int DEFAULT 0,
  UNIQUE(tenant_id, date)
);

CREATE INDEX ON pipeline_stage_history (conversation_id, moved_at DESC);
CREATE INDEX ON metrics_daily (tenant_id, date DESC);
```

---

## 11. Infraestrutura Final

```
┌──────────────────────────────────────────────────────────────────────┐
│  VERCEL                                                              │
│  Next.js 15                                                          │
│  ├── Frontend React (SSR + Client Components)                        │
│  ├── Middleware (auth JWT local — zero Supabase calls)               │
│  └── API Routes BFF (CRUD simples → Supabase)                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼──────────────────────────────────────┐
│  HOSTINGER VPS (mesma VPN do n8n)                                    │
│  ├── livia-gateway (Go binary ou Docker)                             │
│  │   ├── :8080 — webhook receiver (Evolution + Meta)                 │
│  │   ├── :8080/send — outbound message receiver (de Next.js)         │
│  │   ├── :8080/realtime — WebSocket proxy → Supabase                 │
│  │   └── :8080/health — healthcheck                                  │
│  └── n8n (inalterado — só recebe de livia-gateway para IA)           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ REST API + WebSocket
┌───────────────────────────────▼──────────────────────────────────────┐
│  SUPABASE                                                            │
│  ├── PostgreSQL (banco de dados)                                     │
│  ├── Auth (JWT — validado localmente no middleware)                  │
│  ├── Realtime (WebSocket — acessado via Go proxy)                    │
│  └── Storage (attachments de mensagens)                              │
└──────────────────────────────────────────────────────────────────────┘

CANAIS:
  Evolution API (Hostinger) ──→ Go Gateway
  Meta WhatsApp Cloud       ──→ Go Gateway
  Futuro: Telegram, Instagram, SMS ──→ Go Gateway
```

**Domínios sugeridos:**

| Serviço | Domínio |
|---|---|
| Next.js (Vercel) | `app.livia.com.br` |
| Go Gateway | `gateway.livia.com.br` |
| WebSocket Proxy | `realtime.livia.com.br` |
| n8n | `n8n.livia.com.br` (já existe) |

---

## 12. Roadmap e Prioridades

### Visão geral por fase

| Fase | Descrição | Esforço | Impacto | Depende |
|---|---|---|---|---|
| **0** | Performance imediata (Next.js) | 1-2 sem | Alto (lentidão resolve) | — |
| **1** | Modularização do código | 1 sem | Médio (qualidade) | — |
| **2** | Go Message Gateway | 3-4 sem | Muito alto (arquitetura) | — |
| **3** | Multi-agente + URA Engine | 3-4 sem | Muito alto (produto) | Fase 2 |
| **4** | Logs de canal | 1 sem | Alto (operacional) | Fase 2 |
| **5** | Evolução CRM | 4-6 sem | Muito alto (produto) | Fase 3 |

### Sequência recomendada

```
Agora (Fase 0 + Fase 1 em paralelo)
  → Fase 0.B: client-side navigation (maior impacto, mais simples)
  → Fase 0.A: middleware JWT local
  → Fase 1: modularização (rename de pastas, zero risco)
  → Fase 0.C: diagnóstico WebSocket (pode ser investigado junto)

Próximo ciclo (Fase 2)
  → Criar repositório livia-gateway
  → MVP: recebe webhook Evolution, persiste, loga
  → Depois: URA Engine básico (round_robin + least_busy)
  → Depois: outbound pelo Go (tira n8n do envio humano)

Ciclo seguinte (Fase 3 + Fase 4 em paralelo)
  → Schema de multi-agente
  → UI de atribuição e filtros de inbox
  → Tela de logs de canal
  → URA rules CRUD no frontend

Ciclo final (Fase 5)
  → Contacts CRM + campos customizados
  → Pipeline Kanban
  → Reports e métricas
```

### Critérios de sucesso por fase

| Fase | Critério |
|---|---|
| 0 | Troca de conversa < 300ms medido no Network tab |
| 0 | Zero queries Supabase no middleware (verificável via logs Vercel) |
| 2 | 100% das mensagens entram via Go Gateway sem passar pelo n8n |
| 2 | WebSocket Realtime estável para usuários de ISPs diferentes |
| 3 | Agente vê apenas conversas atribuídas a ele por padrão |
| 3 | Regra URA roteia conversa corretamente em < 100ms |
| 4 | Desconexão de canal gera log em < 5s após evento |
| 5 | Contato tem histórico unificado de todas as conversas |

---

*Documento criado em 2026-04-20. Última atualização: 2026-04-23.*

**Histórico de atualizações:**
- 2026-04-20 — Fix B (lazy loading encerradas + SSR enxuto) e Fix D (cache L1/L2/L3 + prefetch batched)
- 2026-04-21 — Fix E (limite SSR 10k→300 + virtualização da lista com react-virtual)
- 2026-04-21 — Fix A (middleware: getSession + cookie x-user-ctx elimina HTTP calls)
- 2026-04-21 — Fix C (diagnóstico WebSocket: Kaspersky proxia WS, sem bloqueio de ISP)
- 2026-04-21 — Fase 1 concluída: components/inbox + /inbox route + redirect 301 + components/shared
- 2026-04-21 — Fase 2 Passo 1 iniciado: livia-gateway deployado em shadow mode na VPS
- 2026-04-22 — Fase 2: fix banco Evolution; nova Evolution deployada; Signum conectada via LIVIA UI
- 2026-04-22 — Fase 2: inbound validado (messages.upsert → gateway → n8n); outbound IA validado
- 2026-04-22 — Fase 2: handlers/outbound.go implementado; send-message roteia Evolution → gateway
- 2026-04-22 — Fase 2: UX otimista (status=sent imediato + after()); stable key no balão; timeout gateway 30s sem falso failed
- 2026-04-22 — Decisão: semântica de status segue padrão WhatsApp/Telegram (sent=servidor recebeu, external_message_id=canal confirmou)
- 2026-04-23 — Fase 2: análise completa dos workflows n8n (First + Master Integrator); Seção 6.10 adicionada com blueprint técnico do Passo 2
- 2026-04-23 — Fase 2: análise do sistema is_muted (estado atual, gap de nova conversa, fix no Gateway); conceito is_blocked documentado como backlog
- 2026-04-23 — Fase 2 Passo 2: implementação completa (normalizer, dedup, supabase client, persister, config, evolution handler, main); RPC upsert_contact_conversation criada; gateway deployado em DUAL WRITE mode
- 2026-04-23 — Fase 2 Passo 2: dual-write validado com mensagens reais (fix tenant_id em MessageInsert); pipeline completo operacional ~500ms
- 2026-04-23 — Decisão arquitetural: Meta Cloud API não será roteada via Evolution; handler nativo no gateway Go mapeado como alvo de médio prazo (Seção 6.11)
