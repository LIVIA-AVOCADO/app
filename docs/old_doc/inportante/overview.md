# Contexto do Projeto - LIVIA MVP

**Última atualização:** 2025-12-05

## Visão Geral
**LIVIA** é uma plataforma SaaS de atendimento com inteligência artificial, **multi-tenant** e **multiusuário**, voltada para empresas que atendem seus clientes finais por canais como WhatsApp, Instagram, webchat e outros.

O **aplicativo do tenant (Versão 1)** é a interface usada pelos **usuários internos da empresa cliente** para:
- Acompanhar e interagir com conversas em tempo real (**Livechat**)
- Gerenciar o conteúdo da **Base de Conhecimento** (bases e synapses)
- **Testar e treinar o uso do conhecimento** pelo agente de IA (**Treinamento Neurocore**)

## Telas Principais do MVP

### 1. Livechat
Centro operacional de atendimento. Permite:
- **Visualizar** lista de contatos e conversas
- **Acompanhar em tempo real** (Supabase Realtime) mensagens entre cliente ↔ IA ↔ usuário
- **Pausar/retomar** conversa (nível conversa) e IA (nível específico)
- **Enviar mensagens manuais** (via n8n para canal)
- **Retomar conversas encerradas** pela IA
- **Quick Replies** - Comando "/" para respostas rápidas
- **Message Feedback** - Like/dislike em mensagens da IA
- **Conversation Summary** - Modal com dados extraídos do cliente
- **4 Filtros** - Ativas, Aguardando, Encerradas, Todas
- **Auto-Pause IA** - IA pausa ao atendente enviar mensagem

### 2. Base de Conhecimento
Modelagem do conhecimento usado pela IA. Permite:
- **CRUD de bases** de conhecimento (agrupamentos lógicos)
- **CRUD de synapses** (unidades de conteúdo)
  - Título, content, descrição, image_url
  - Estados: draft, indexing, publishing, error
  - Flag is_enabled (ativar/desativar)
- **Layout Master-Detail** - Scroll horizontal de cards + tabela de synapses
- **Fluxo de publicação**: draft → publish → n8n processa → embeddings criados e armazenados externamente
- **Webhooks N8N** - Integração para sync/delete/toggle embeddings

### 3. Treinamento Neurocore
Interface de teste e validação do comportamento da IA. Permite:
- **Simular perguntas** para a IA
- **Visualizar resposta** gerada (renderização markdown)
- **Ver synapses usadas** na resposta com score de similaridade
- **Feedback de respostas** - Like/dislike com comentário opcional
- **Modo mock** configurável (desenvolvimento sem n8n)
- **Auto-scroll** para última resposta
- **Limite de 20 queries** no histórico (performance)

### 4. CRM Kanban Board 🆕
Organização visual de conversas. Permite:
- **Board Kanban** com colunas por tags
- **CRUD de tags** (nome, cor, ordem)
- **Associação many-to-many** (conversa ↔ tags)
- **Filtros** por status e busca
- **Drag-and-drop** preparatório
- **RLS policies** para multi-tenant

### 5. Profile Page 🆕
Perfil do usuário e controle global. Permite:
- **Exibir** informações do usuário e tenant
- **Avatar** display
- **AI Global Pause Control** - Pausar TODA a IA do tenant
  - Confirmação de segurança (digitar "PAUSAR")
  - Persiste no banco (`tenants.ai_paused`)
- **Logout**

### 6. Meus Agentes IA ✅ (Completo - Dez 2025)
Interface de gerenciamento e personalização dos agentes de IA do tenant. Permite:
- **Listar agents** do neurocore associado ao tenant (scroll horizontal de cards)
- **Visualizar configuração** de cada agent (layout master-detail com tabs)
- **Card clicável** - Interação intuitiva (clique em qualquer lugar do card)
- **Painel master-detail** - Expande abaixo dos cards após seleção
- **Editar prompts personalizados** por tenant com **6 tabs organizadas**:
  - **Personalidade** - Nome, idade, gênero, objetivo, comunicação, personalidade
  - **Limitações** - O que o agent NÃO deve fazer (estrutura hierárquica)
  - **Instruções** - O que o agent DEVE fazer (estrutura hierárquica)
  - **Guideline** - Roteiro estruturado de atendimento
  - **Regras** - Regras que o agent deve seguir (estrutura hierárquica)
  - **Outras Instruções** - Instruções complementares (estrutura hierárquica)
- **Estrutura hierárquica GuidelineStep[]**:
  - Cada campo JSONB tem: title, type (rank/markdown), active, sub-instruções
  - Sub-instruções com: content, active
  - Editor com expand/collapse, add/remove steps e sub-instruções
- **Server Actions funcionais**:
  - Salvar alterações (create ou update)
  - Resetar para configuração padrão do template
  - Cancelar sem salvar
- **UX aprimorada**:
  - Card totalmente clicável (sem botão "Editar Configuração")
  - Scroll vertical natural da página (sem scroll interno)
  - Seleção visual com ring border
  - Hover com shadow para feedback visual
- **Herança de configuração**: Tenant herda configuração base e pode personalizar
- **Multi-tenant seguro**: RLS policies garantem isolamento por tenant

## Estado Atual
**Fase:** MVP em Desenvolvimento - **~95% Completo** 🚀

**Completado:**
- ✅ **Projeto Next.js 15** configurado (App Router + TypeScript strict)
- ✅ **Supabase** integrado (Auth + Database + Realtime)
- ✅ **shadcn/ui** configurado (25+ componentes)
- ✅ **Livechat** completo (19 componentes + Realtime + Quick Replies + Feedback)
- ✅ **Base de Conhecimento** completa (hierarquia + master-detail + webhooks n8n)
- ✅ **Treinamento Neurocore** completo (chat + feedback + modo mock)
- ✅ **CRM Kanban Board** completo (tags + filtros + RLS)
- ✅ **Profile Page** completo (AI Global Pause + user info)
- ✅ **Meus Agentes IA** ✅ **COMPLETO** (Dez 2025)
  - Interface master-detail com 6 tabs
  - Card clicável (UX aprimorada)
  - Estrutura hierárquica GuidelineStep[] completa
  - Editor hierárquico com add/remove/toggle
  - Server Actions (save, reset, cancel)
  - Scroll vertical natural da página
  - Build e type-check passando
- ✅ **80+ componentes** criados
- ✅ **14 API routes** implementadas
- ✅ **9 migrações SQL** executadas
- ✅ **20 decisões arquiteturais** documentadas
- ✅ **15 itens do BACKLOG** concluídos

**Gaps Resolvidos:**
- ✅ Gap #1: Hierarquia Base de Conhecimento (resolvido)
- ✅ Gap #3: Feedback de mensagens (resolvido)
- ✅ Gap #4: Respostas rápidas (resolvido)

**Próximo:** RLS Policies para agents/agent_prompts + Testes manuais

## Objetivos da Próxima Sessão
- [ ] **Finalizar RLS Policies** para `agents` e `agent_prompts`
- [ ] **Testar UI de Meus Agentes** manualmente
- [ ] **Agent Templates UI** - Interface para gerenciar templates (Super Admin)
  - CRUD de templates (`agent_templates`)
  - Formulário com validação Zod
  - Integração com neurocores
- [ ] **Dashboard/Analytics** - KPIs, gráficos, métricas
- [ ] **Cards por Conversa** - Refatoração livechat (Decisão #013)
- [ ] **Drag-and-drop CRM** - Finalizar funcionalidade Kanban
- [ ] **Testes E2E** - Cobertura de fluxos críticos

## Features Adicionais Implementadas

### Meus Agentes IA ✅ (Dez 2025 - COMPLETO)
**Interface master-detail com tabs para gerenciar agents:**
- **Layout master-detail** - Scroll horizontal de cards + painel expansível
- **Card clicável** - Interação intuitiva (hover com shadow-lg)
- **6 tabs organizadas** - Sem scroll longo vertical
- **Estrutura hierárquica GuidelineStep[]** completa:
  - Cada campo JSONB: title, type (rank/markdown), active, sub-instruções
  - Sub-instruções: content, active
- **Editor hierárquico** - 4 form sections (860 linhas):
  - LimitationsSection - O que agent NÃO deve fazer
  - InstructionsSection - O que agent DEVE fazer
  - RulesSection - Regras que agent deve seguir
  - OthersInstructionsSection - Instruções complementares
- **Funcionalidades do editor**:
  - Adicionar/remover steps principais
  - Editar título, tipo, status ativo
  - Expand/collapse de steps
  - Adicionar/remover sub-instruções
  - Toggle ativo/inativo por sub-instrução
- **UX aprimorada** (Dez 05):
  - Card totalmente clicável (sem botão separado)
  - Scroll vertical natural (sem scroll interno)
  - Seleção visual com ring-2 ring-primary
  - Hover feedback com shadow-lg
- **Server Actions**:
  - `updateAgentPromptAction` - Salva alterações (create ou update)
  - `resetAgentPromptToDefaultAction` - Reseta para template
- **Componentes** (8 total):
  - AgentsList, AgentCard (clicável)
  - AgentEditPanel, AgentEditHeader, AgentEditTabs
  - PersonalitySection + 4 form sections hierárquicas
- **Princípios SOLID** aplicados corretamente
- **Types e validações Zod** atualizados
- Frontend 100% adaptado à estrutura do banco
- Build e type-check passando sem erros

### Quick Replies Management (Nov 20-Dez 04)
- Comando "/" no input abre painel flutuante
- Busca em tempo real por título/emoji
- Contador de uso automático (mais utilizadas destacadas)
- CRUD completo de templates
- 3 API routes + 5 componentes

### Message Feedback System
- Botões like/dislike em hover sobre mensagens da IA
- Comentário opcional para feedback negativo
- Storage em `message_feedbacks` com context JSON
- Rastreabilidade completa

### CRM Kanban Board
- Board Kanban com colunas por tags
- CRUD de tags (nome, cor, ordem)
- Associação many-to-many (conversa ↔ tags)
- Filtros por status e busca
- RLS policies completas

### Conversation Summary Modal
- Botão "Resumo" no header da conversa
- Exibe dados extraídos do contact
- Campos: nome, telefone, email, metadata JSON
- Funcionalidade copiar para clipboard

### Profile Page + AI Global Pause
- Página `/perfil` com dados do usuário e tenant
- Switch para pausar TODA a IA do tenant
- Confirmação de segurança (digitar "PAUSAR")
- Persiste em `tenants.ai_paused`

### Auto-Pause IA
- IA pausa automaticamente quando atendente envia mensagem
- Evita conflito entre respostas humanas e IA
- Integração com webhook n8n
- Badge visual muda automaticamente

### Conversation Tags Management
- Sistema completo de tags para conversas
- Associação many-to-many (conversa ↔ tags)
- RLS policies para isolamento multi-tenant
- 3 migrações SQL

### UI/UX Improvements
- Logo adicionada à página de login
- Melhorado UI dos balões de mensagens
- Corrigida lógica de loading
- Cores globais alteradas
- Layout do header da conversa modificado

## Tecnologias Utilizadas
- **Next.js 15** - Framework React com App Router
- **Supabase** - BaaS (Auth + Database + Realtime)
- **n8n** - Orquestração de workflows de IA
- **shadcn/ui** - Biblioteca de componentes UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização

## Estrutura do Projeto
```
projeto/                                    ← Raiz = Projeto Next.js ✅
├── app/                                    ← App Router (páginas Next.js)
│   ├── page.tsx                            # Home page
│   ├── layout.tsx                          # Layout raiz
│   ├── globals.css                         # Estilos globais
│   ├── livechat/page.tsx                   # Página Livechat
│   └── api/                                # API Routes
│       ├── conversations/pause-ia/
│       ├── conversations/resume-ia/
│       └── n8n/send-message/
├── components/                             ← Componentes React
│   ├── livechat/                           # Componentes Livechat
│   └── ui/                                 # shadcn/ui components
├── lib/                                    ← Bibliotecas e utilidades
│   ├── supabase/                           # Cliente Supabase
│   ├── queries/                            # Queries Supabase
│   ├── hooks/                              # React hooks
│   └── utils.ts                            # Funções auxiliares
├── types/                                  ← Tipos TypeScript
│   ├── database.ts                         # Tipos gerados Supabase
│   └── livechat.ts                         # Tipos Livechat
├── public/                                 ← Assets estáticos
├── scripts/                                ← Scripts utilitários
│   ├── test-supabase.js
│   ├── seed-database.js
│   ├── clean-database.js
│   └── verify-seed.js
├── .claude/skills/livia-mvp/              ← Skills Claude Code
│   ├── SKILL.md                            # Skill principal
│   ├── n8n-reference.md                    # Padrões de integração n8n
│   ├── supabase-reference.md               # Queries e Realtime
│   ├── frontend-reference.md               # Next.js e shadcn/ui
│   ├── states-and-flows.md                 # Estados e fluxos
│   └── webhooks-livia.md                   # Webhooks LIVIA
├── docs/                                   ← Documentação técnica
│   ├── database-schema.md
│   ├── types-example.ts
│   ├── SETUP.md
│   ├── webhook-implementation-notes.md
│   └── migrations/
│       ├── 001_schema_improvements.sql
│       └── 001_schema_improvements_v2.sql  ✅
├── package.json                            ← Dependências (consolidado)
├── next.config.ts                          ← Config Next.js
├── tsconfig.json                           ← Config TypeScript
├── tailwind.config.ts                      ← Config Tailwind
├── .env.local                              ← Variáveis de ambiente
├── CONTEXT.md
├── PROGRESS.md
├── DECISIONS.md
└── REFACTORING_PLAN.md                     ← Plano de refatoração ✅
```

## Dependências Principais
**Runtime:**
- next@15
- react@18
- @supabase/ssr
- @supabase/supabase-js

**UI:**
- shadcn/ui components
- tailwindcss
- lucide-react (ícones)

**Dev:**
- typescript
- eslint
- prettier (recomendado)

## Observações Importantes

### Decisões Arquiteturais
- ❌ **MCP não será usado no MVP** - Foco em simplicidade e entrega rápida
- ✅ **Skills customizadas** - Estrutura híbrida com referências especializadas
- ✅ **Server Components por padrão** - Client components apenas quando necessário

### Segurança
- NUNCA expor webhooks n8n no client
- Sempre validar `tenant_id` nas queries (multi-tenancy)
- Usar RLS (Row Level Security) em todas as tabelas Supabase
- API Routes como proxy para n8n

### Convenções
- Componentes: PascalCase
- Arquivos: kebab-case
- Tipos: Importar de `@/types/database` ou `@/types/models`

### Conceitos Importantes

**Multi-tenancy**:
- Isolamento total por `tenant_id`
- RLS (Row Level Security) em todas as tabelas
- Usuários só vêem dados do próprio tenant

**Synapses e Base Vetorial**:
- **Synapse**: Unidade de conhecimento (título + content + descrição)
- **Embeddings**: Synapse é publicada → n8n processa → chunks vetorizados (OpenAI ada-002) → armazenados em base vetorial externa (gerenciada pelo n8n)
- **Busca semântica**: IA (via n8n) faz query vetorial para encontrar synapses relevantes
- **Frontend**: Apenas gerencia CRUD de synapses, não acessa embeddings diretamente

**Estados de Conversa**:
- `open`: Conversa ativa
- `paused`: Conversa pausada (IA para)
- `closed`: Conversa encerrada
- `ia_active`: Controla se IA responde ou não (independente do status)

**Fluxo de Integração**:
```
Frontend → API Route → n8n Webhook → IA/Canal → Callback → Supabase → Realtime → Frontend
```

### Webhooks n8n (MVP WhatsApp - 6 webhooks)
- `/webhook/livia/send-message` - Enviar mensagem para WhatsApp
- `/webhook/livia/sync-synapse` - Publicar/editar synapse (vetorização)
- `/webhook/livia/pause-conversation` - Pausar conversa (IA + usuário)
- `/webhook/livia/resume-conversation` - Retomar conversa
- `/webhook/livia/pause-ia` - Pausar IA (conversa específica)
- `/webhook/livia/resume-ia` - Retomar IA (conversa específica)

**Webhooks removidos do MVP** (substituídos por CRUD no banco):
- ❌ `neurocore-query` - Query de treinamento (CRUD)
- ❌ `use-quick-reply` - Incrementar contador (CRUD)

**Veja documentação completa**: [webhooks-livia.md](.claude/skills/livia-mvp/webhooks-livia.md)
**Veja decisão arquitetural**: [DECISIONS.md - Decisão #005](DECISIONS.md)

## Documentação Detalhada

- **Schema do Banco**: [docs/database-schema.md](docs/database-schema.md)
- **Estados e Fluxos**: [.claude/skills/livia-mvp/states-and-flows.md](.claude/skills/livia-mvp/states-and-flows.md)
- **Webhooks n8n**: [.claude/skills/livia-mvp/webhooks-livia.md](.claude/skills/livia-mvp/webhooks-livia.md)
- **Migração SQL**: [docs/migrations/001_schema_improvements_v2.sql](docs/migrations/001_schema_improvements_v2.sql)
- **Tipos TypeScript (exemplo)**: [docs/types-example.ts](docs/types-example.ts)

## Links Úteis
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## Variáveis de Ambiente Necessárias
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # Para server-side admin

# n8n Base URL
N8N_BASE_URL=https://n8n.example.com

# n8n Webhooks LIVIA (MVP WhatsApp - 6 webhooks)
N8N_SEND_MESSAGE_WEBHOOK=/webhook/livia/send-message
N8N_SYNC_SYNAPSE_WEBHOOK=/webhook/livia/sync-synapse
N8N_PAUSE_CONVERSATION_WEBHOOK=/webhook/livia/pause-conversation
N8N_RESUME_CONVERSATION_WEBHOOK=/webhook/livia/resume-conversation
N8N_PAUSE_IA_WEBHOOK=/webhook/livia/pause-ia
N8N_RESUME_IA_WEBHOOK=/webhook/livia/resume-ia

# n8n Callback Configuration
N8N_CALLBACK_SECRET=random-secret-key-here
N8N_CALLBACK_BASE_URL=https://livia-app.example.com/api/n8n/callback
```
