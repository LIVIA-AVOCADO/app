# Progresso do Projeto - LIVIA MVP

## Sessão 2025-12-05 (Tarde) - Refatoração Master-Detail + UX Improvements "Meus Agentes IA"

### Completado
- [x] Revisar plano de refatoração (meus-agentes-tabs-refactor-plan.md - 628 linhas)
- [x] Confirmar implementação completa (100% do plano executado)
- [x] UX Improvement #1: Card totalmente clicável (remover botão "Editar Configuração")
- [x] UX Improvement #2: Scroll vertical da página (layout do dashboard + painel)
- [x] Executar build de produção (passou com sucesso - 24.4s)
- [x] Documentar mudanças em status-projeto.md e overview.md

### Funcionalidades Implementadas

**Refatoração Dialog → Tabs (Master-Detail):**
Migração completa de interface modal para master-detail com tabs:

- ✅ **AgentCard simplificado** - Card inteiro clicável (sem botão)
- ✅ **Seleção visual** - Ring border quando selecionado
- ✅ **Painel master-detail** - Expande abaixo dos cards
- ✅ **6 tabs organizadas**:
  1. Personalidade (name, age, gender, objective, comunicação, personality)
  2. Limitações (estrutura hierárquica GuidelineStep[])
  3. Instruções (estrutura hierárquica GuidelineStep[])
  4. Guideline (roteiro de atendimento)
  5. Regras (estrutura hierárquica GuidelineStep[])
  6. Outras Instruções (estrutura hierárquica GuidelineStep[])
- ✅ **Navegação por tabs** - Sem scroll longo vertical
- ✅ **Footer com ações**:
  - Botão "Resetar para Padrão" (reseta personalizações)
  - Botão "Cancelar" (fecha painel sem salvar)
  - Botão "Salvar Alterações" (persiste no banco)
- ✅ **Scroll da página** - Layout ajustado para scroll natural
- ✅ **Server Actions** implementadas:
  - `updateAgentPromptAction` - Salva alterações (create ou update)
  - `resetAgentPromptToDefaultAction` - Reseta para configuração do template

**UX Improvements:**
- ✅ Card clicável: Interação mais intuitiva (clique em qualquer lugar do card)
- ✅ Hover aprimorado: `hover:shadow-lg` para indicar clicabilidade
- ✅ Scroll vertical: Layout do dashboard com `overflow-y-auto`
- ✅ Sem scroll interno: Painel expande naturalmente, scroll apenas da página

### Arquivos Criados (Refatoração Original - Dez 2025)

**Componentes Master-Detail (4):**
- `components/agents/agent-edit-panel.tsx` - Container do painel (40 linhas)
- `components/agents/agent-edit-header.tsx` - Header com badges e botão fechar (68 linhas)
- `components/agents/agent-edit-tabs.tsx` - Navegação de tabs + form (210 linhas)
- `components/agents/form-sections/personality-section.tsx` - Seção de personalidade (120 linhas)

**Form Sections Existentes (4):**
- `components/agents/form-sections/limitations-section.tsx` - Editor hierárquico (7774 bytes)
- `components/agents/form-sections/instructions-section.tsx` - Editor hierárquico (7624 bytes)
- `components/agents/form-sections/rules-section.tsx` - Editor hierárquico (7463 bytes)
- `components/agents/form-sections/others-instructions-section.tsx` - Editor hierárquico (7794 bytes)
- `components/agents/form-sections/guideline-section.tsx` - Editor guideline (8457 bytes)

### Arquivos Modificados (Hoje - 2025-12-05 Tarde)

**UX Improvements:**
- `components/agents/agent-card.tsx` - Card simplificado e totalmente clicável
- `app/(dashboard)/layout.tsx` - Scroll vertical habilitado (`overflow-y-auto`)
- `components/agents/agent-edit-tabs.tsx` - Removido scroll interno
- `components/agents/agent-edit-panel.tsx` - Simplificado (sem controle de altura)

**Refatoração Anterior (Implementação Master-Detail):**
- `components/agents/agents-list.tsx` - Estado de seleção + painel condicional
- `app/(dashboard)/meus-agentes/page.tsx` - Usa AgentsList com master-detail

### Arquivos Deletados
- `components/agents/agent-edit-dialog.tsx` - Dialog modal antigo ❌ REMOVIDO

### Decisão Técnica Crítica

**Migração Dialog → Tabs (Master-Detail):**

**Por quê:**
- UX superior: Navegação por tabs vs scroll longo
- Contexto mantido: Vê os cards acima enquanto edita
- Layout similar: Base de Conhecimento já usa master-detail
- Menos scroll vertical: Uma tab por vez

**Trade-offs:**
- Mais componentes (+4 novos)
- VS
- Melhor UX de navegação e organização visual
- **Escolha:** UX vence (MVP em 90%, priorizar experiência)

**Card Clicável:**
- Interação mais intuitiva (padrão conhecido)
- UI mais limpa (sem botão)
- Hover aprimorado para feedback visual

**Scroll Vertical:**
- Página inteira com scroll natural
- Painel expande com conteúdo completo
- Sem scroll duplo (interno + externo)

### Princípios SOLID Aplicados

**Single Responsibility (SRP):**
- `AgentsList`: Orquestrar estado de seleção
- `AgentCard`: Apenas renderizar card + callback onClick
- `AgentEditPanel`: Container do painel (layout)
- `AgentEditHeader`: Header com badges e botão fechar
- `AgentEditTabs`: Navegação de tabs + React Hook Form
- Cada form section: Gerenciar apenas seus campos

**Open/Closed (OCP):**
- Componentes aceitam callbacks (`onSelect`, `onClose`, `onSuccess`)
- Fácil adicionar novos tabs sem modificar panel
- Form sections extensíveis

**Liskov Substitution (LSP):**
- Todas form sections seguem contrato `{ form: UseFormReturn<AgentPromptFormData> }`
- Substituíveis entre si

**Interface Segregation (ISP):**
- `AgentCardProps`: Apenas `agent`, `isSelected`, `onSelect`
- `AgentEditPanelProps`: Apenas `agent`, `onClose`, `onSuccess`
- Props específicas por componente

**Dependency Inversion (DIP):**
- Componentes dependem de abstrações (callbacks)
- Não dependem de implementações (router, state global)

### Layout Visual Implementado

```
┌────────────────────────────────────────────────────────────────┐
│ [Sidebar] │ Meus Agentes IA                                    │
│           │                                                     │
│           │ ┌──────┐  ┌──────┐  ┌──────┐  ← Scroll horizontal │
│           │ │Agent1│  │Agent2│  │Agent3│                       │
│           │ │ RING │  │      │  │      │  ← Card clicável      │
│           │ └──────┘  └──────┘  └──────┘                       │
│           │    ↑ SELECIONADO (ring-2 ring-primary)            │
│           │ ═══════════════════════════════════════           │
│           │                                                     │
│           │ ┌─────────────────────────────────────────────┐   │
│           │ │ 🤖 Agent Recepcionista  [Personalizado] [×] │   │
│           │ │ Template: XYZ | Recepcionista | Reativo     │   │
│           │ ├─────────────────────────────────────────────┤   │
│           │ │ [Personalidade] [Limitações] [Instruções].. │   │
│           │ ├─────────────────────────────────────────────┤   │
│           │ │                                              │   │
│           │ │  [Conteúdo da Tab - PersonalitySection]     │   │
│           │ │  Nome: [input]                               │   │
│           │ │  Idade: [input]                              │   │
│           │ │  ...                                         │   │
│           │ │                                              │   │
│           │ ├─────────────────────────────────────────────┤   │
│           │ │ [Resetar] [Cancelar] [Salvar Alterações]   │   │
│           │ └─────────────────────────────────────────────┘   │
│           ↕ ← Scroll vertical da página                       │
└────────────────────────────────────────────────────────────────┘
```

### Métricas

**Refatoração Master-Detail:**
- **Componentes criados**: 4 (panel, header, tabs, personality-section)
- **Linhas de código**: ~438 (vs ~390 estimadas)
- **Componentes deletados**: 1 (agent-edit-dialog)
- **Arquivos modificados (refatoração)**: 2 (agent-card, agents-list)
- **Arquivos modificados (UX hoje)**: 4 (card, layout, tabs, panel)

**Build e Testes:**
- **Build time**: 24.4s (Next.js 16.0.3)
- **Type-check**: ✅ Zero erros (36.2s)
- **Compilação**: ✅ Sucesso
- **Páginas geradas**: 22
- **Rota `/meus-agentes`**: ✅ ƒ (Dynamic) server-rendered

### Funcionalidades Extras Implementadas

Além do plano original:

1. **Botão "Resetar para Padrão"** ✅
   - Implementado no footer do AgentEditTabs
   - Server Action: `resetAgentPromptToDefaultAction`
   - Busca configuração base e copia para tenant
   - Confirmação de segurança (confirm dialog)

2. **BasicInfoSection** ⚠️ (criado mas não integrado)
   - Componente de informações read-only
   - Não está nas tabs (pode ser adicionado futuramente)

### Próximos Passos

1. **Testar UI manualmente** - Validar navegação, save, reset, cancel
2. **Adicionar confirmação antes de fechar com alterações não salvas** (opcional)
3. **Integrar BasicInfoSection** - Decidir se adiciona como 7ª tab ou remove
4. **RLS Policies** - Garantir segurança multi-tenant para agents/agent_prompts
5. **Adicionar indicadores de configuração personalizada** - Visual diff entre base e personalizado

### Bloqueios/Problemas Resolvidos

- ✅ Scroll interno vs scroll da página → Layout ajustado (overflow-y-auto no dashboard)
- ✅ Card com botão redundante → Card totalmente clicável (UX aprimorada)
- ✅ Painel muito alto → Scroll natural da página (sem altura máxima)
- ✅ Build passou com sucesso → Código pronto para produção

---

# Progresso do Projeto - LIVIA MVP

## Sessão 2025-12-05 - Feature "Meus Agentes IA" - Adaptação Frontend para Estrutura JSONB

### Completado
- [x] Analisar estrutura de dados vinda do banco (campos JSONB com GuidelineStep[])
- [x] Atualizar types em `types/agents.ts` para usar GuidelineStep[] em todos campos JSONB
- [x] Atualizar Zod validation em `lib/validations/agentPromptValidation.ts`
- [x] Reescrever 4 componentes de formulário para estrutura hierárquica:
  - `limitations-section.tsx`
  - `instructions-section.tsx`
  - `rules-section.tsx`
  - `others-instructions-section.tsx`
- [x] Verificar type-check (passou sem erros)
- [x] Executar build de produção (passou com sucesso)

### Funcionalidades Implementadas

**Estrutura Hierárquica GuidelineStep[]:**
Todos os campos JSONB (`limitations`, `instructions`, `rules`, `others_instructions`, `guide_line`) agora usam a estrutura:
```typescript
{
  title: string,           // Título da instrução/regra/limitação
  type: 'rank' | 'markdown',  // Tipo de renderização
  active: boolean,         // Se está ativo
  sub: [{                  // Sub-instruções
    content: string,
    active: boolean
  }]
}
```

**Form Sections com Editor Hierárquico:**
Cada seção de formulário agora suporta:
- ✅ Adicionar/remover steps (instruções principais)
- ✅ Editar título do step
- ✅ Toggle ativo/inativo por step
- ✅ Selecionar tipo (rank/markdown)
- ✅ Expand/collapse de steps
- ✅ Adicionar/remover sub-instruções dentro de cada step
- ✅ Editar conteúdo de sub-instruções
- ✅ Toggle ativo/inativo por sub-instrução

**Componentes Reescritos (4):**
1. **LimitationsSection** - Editor de limitações (o que o agent NÃO deve fazer)
2. **InstructionsSection** - Editor de instruções (o que o agent DEVE fazer)
3. **RulesSection** - Editor de regras que o agent deve seguir
4. **OthersInstructionsSection** - Editor de instruções complementares

### Arquivos Modificados

**Types:**
- `types/agents.ts` - Atualizado TODOS campos JSONB para GuidelineStep[]

**Validações:**
- `lib/validations/agentPromptValidation.ts` - Atualizado schemas Zod para GuidelineStep[]

**Componentes (Reescrita Completa):**
- `components/agents/form-sections/limitations-section.tsx` - 215 linhas
- `components/agents/form-sections/instructions-section.tsx` - 215 linhas
- `components/agents/form-sections/rules-section.tsx` - 215 linhas
- `components/agents/form-sections/others-instructions-section.tsx` - 215 linhas

### Decisão Técnica Crítica

**Usuário explicitou:** "O banco esta certoo.. tempos que adaptar o front ao banco"

Esta foi uma decisão fundamental:
- ❌ NÃO modificar estrutura do banco de dados
- ✅ Adaptar completamente o frontend para a estrutura existente do banco
- ✅ Manter a hierarquia complexa GuidelineStep[] conforme está no banco

**Trade-off:**
- Mais complexidade no frontend (componentes mais elaborados)
- VS
- Estrutura de dados mais expressiva e flexível no backend
- **Escolha:** Flexibilidade e expressividade vencem

### Princípios SOLID Aplicados

**Single Responsibility:**
- Cada form section gerencia apenas seu campo específico
- Funções separadas para: add/remove step, add/remove sub, update fields

**Open/Closed:**
- Componentes extensíveis via callbacks do React Hook Form
- Fechados para modificação (lógica interna estável)

**Dependency Inversion:**
- Componentes dependem de abstrações (UseFormReturn interface)
- Não dependem de implementações concretas de state management

### Estrutura GuidelineStep Implementada

```typescript
export type GuidelineStep = {
  title: string;               // Título da etapa
  type: 'rank' | 'markdown';  // Tipo de renderização
  active: boolean;            // Se a etapa está ativa
  sub: GuidelineSubInstruction[];  // Array de sub-instruções
};

export type GuidelineSubInstruction = {
  content: string;  // Conteúdo da sub-instrução
  active: boolean;  // Se a sub-instrução está ativa
};
```

**Diferença entre `type`:**
- **rank**: Instruções numeradas (1, 2, 3...) para seguir sequencialmente
- **markdown**: Permite formatação com markdown (*negrito*, _itálico_, emojis)

### Métricas

- **Componentes reescritos**: 4 (100% reescrita)
- **Linhas de código**: ~860 (4 componentes × 215 linhas)
- **Types atualizados**: 2 arquivos (types/agents.ts, validations)
- **Build time**: ~20.7s
- **Type-check**: ✅ Zero erros
- **Campos adaptados**: 5 campos JSONB (limitations, instructions, rules, others_instructions, guide_line)

### Próximos Passos

1. **Testar UI manualmente** - Verificar funcionalidade de add/remove/edit
2. **Implementar PersonalitySection** - Campos de personalidade (name, age, gender, etc)
3. **Integrar com AgentCard** - Exibir contadores de regras/instruções
4. **Implementar save functionality** - Server action para salvar alterações
5. **RLS Policies** - Garantir segurança multi-tenant para agents

### Bloqueios/Problemas Resolvidos

- ✅ Estrutura de dados incompatível entre banco e frontend → Adaptado frontend completamente
- ✅ Type mismatches após atualização de types → Reescritos componentes
- ✅ Validação Zod não aceita GuidelineStep[] → Atualizado schema
- ✅ Build errors → Resolvidos (build passou)

---

## Sessão 2025-11-20 a 2025-12-04 - Features Finais MVP + UI/UX Improvements

### Completado
- [x] Quick Replies Management (CRUD completo + comando "/")
- [x] Message Feedback System (like/dislike em mensagens)
- [x] CRM Kanban Board (organização por tags)
- [x] Conversation Summary Modal (extração de dados do cliente)
- [x] Profile Page (exibição de usuário + tenant)
- [x] AI Global Pause Control (pausa system-wide com confirmação)
- [x] Conversation Tags Management (many-to-many + RLS)
- [x] Auto-Pause IA (quando atendente envia mensagem)
- [x] UI/UX Improvements (logo, cores, loading, layout)

### Funcionalidades Implementadas

**Quick Replies Management:**
- ✅ CRUD completo de quick replies
- ✅ Comando "/" no input abre painel flutuante
- ✅ Busca em tempo real por título/emoji
- ✅ Contador de uso automático (mais utilizadas destacadas)
- ✅ Badge "Mais Usada" para top replies
- ✅ Emoji picker integrado
- ✅ 3 API routes: `/api/quick-replies`, `/api/quick-replies/[id]`, `/api/quick-replies/usage`

**Message Feedback System:**
- ✅ Botões like/dislike em hover sobre mensagens da IA
- ✅ Feedback positivo: 1 clique (thumb-up)
- ✅ Feedback negativo: abre modal para comentário opcional
- ✅ Storage em `message_feedbacks` com context JSON
- ✅ Rastreabilidade completa (tenant_id, conversation_id, etc.)

**CRM Kanban Board:**
- ✅ Nova página `/crm` com board Kanban
- ✅ Organização de conversas por tags (coluna por tag)
- ✅ CRUD de tags (nome, cor, ordem)
- ✅ Associação many-to-many (conversa ↔ tags)
- ✅ Filtros por status e busca
- ✅ Drag-and-drop preparatório
- ✅ RLS policies completas para multi-tenant

**Conversation Summary Modal:**
- ✅ Botão "Resumo" no header da conversa
- ✅ Modal exibe dados extraídos do contact
- ✅ Campos: nome, telefone, email, metadata JSON
- ✅ Botão copiar para clipboard
- ✅ Seções: Dados do Cliente, Memória, Pendências
- ✅ Empty states quando sem dados

**Profile Page + AI Global Pause:**
- ✅ Nova página `/perfil`
- ✅ Exibição de informações do usuário e tenant
- ✅ Avatar display
- ✅ **Controle Global de Pausa da IA**
  - Switch para pausar TODA a IA (system-wide)
  - Confirmação de segurança (digitar "PAUSAR")
  - Persiste em `tenants.ai_paused`
  - n8n verifica antes de processar mensagens
- ✅ Botão logout

**Conversation Tags Management:**
- ✅ Sistema completo de tags para conversas
- ✅ Associação many-to-many (conversation ↔ tags)
- ✅ CRUD de tags (nome, cor, ordem)
- ✅ Filtros por tag no livechat
- ✅ RLS policies para isolamento multi-tenant
- ✅ Tabelas: `conversation_tags` e `conversation_tag_associations`

**Auto-Pause IA When Attendant Sends:**
- ✅ Quando atendente envia mensagem, IA pausa automaticamente
- ✅ Evita conflito entre respostas humanas e IA
- ✅ Integração com webhook n8n
- ✅ Atualiza campo `ia_active = false` no banco
- ✅ Feedback visual imediato (badge muda para "IA Pausada")

**UI/UX Improvements:**
- ✅ Corrigido bug da logo (commit `68be911`)
- ✅ Melhorado UI dos balões de mensagens (commit `6cb3440`)
- ✅ Corrigida lógica de loading (commit `c12ec1e`)
- ✅ Logo adicionada à página de login (commit `70f9936`)
- ✅ Filtro "ativo" como padrão no livechat (commit `0b4a8e3`)
- ✅ Layout do header da conversa modificado (commit `d1e1f78`)
- ✅ Cores globais alteradas (commit `57eccf0`)

### Arquivos Criados (37 arquivos)

**Componentes (14):**
- `components/livechat/quick-reply-dialog.tsx`
- `components/livechat/quick-reply-item.tsx`
- `components/livechat/quick-replies-panel.tsx`
- `components/livechat/quick-replies-manager.tsx`
- `components/livechat/quick-reply-command.tsx`
- `components/livechat/message-feedback-buttons.tsx`
- `components/livechat/conversation-summary-modal.tsx`
- `components/livechat/customer-data-panel.tsx`
- `components/crm/crm-kanban-board.tsx`
- `components/crm/crm-kanban-column.tsx`
- `components/crm/crm-conversation-card.tsx`
- `components/crm/crm-filters.tsx`
- `components/profile/ai-control.tsx`
- `app/(dashboard)/perfil/page.tsx`

**API Routes (7):**
- `app/api/quick-replies/route.ts` (GET/POST)
- `app/api/quick-replies/[id]/route.ts` (GET/PUT/DELETE)
- `app/api/quick-replies/usage/route.ts` (POST)
- `app/api/feedback/message/route.ts` (POST)
- `app/(dashboard)/crm/page.tsx`

**Queries (3):**
- `lib/queries/quick-replies.ts` (265 linhas - 8 funções)
- `lib/queries/crm.ts` (3+ funções)
- `lib/queries/feedback.ts` (1+ função)

**Types (2):**
- `types/crm.ts` (Tag, ConversationWithTagsAndContact, etc.)
- Atualizações em `types/livechat.ts`

**Migrações (6):**
- `migrations/003_message_status_enum.sql`
- `migrations/005_alter_quick_reply_templates.sql`
- `migrations/006_create_conversation_tags.sql`
- `migrations/007_alter_tags_add_order_color.sql`
- `migrations/008_add_tags_rls.sql`
- `migrations/seed-quick-replies-signum.sql`

**Documentação (5):**
- Atualizações em `.env.local.example`
- 7 decisões arquiteturais adicionadas (#014-#020)
- 6 itens do BACKLOG marcados como concluídos
- 6 decisões rápidas adicionadas

### Arquivos Modificados (15+)

**Livechat:**
- `components/livechat/message-input.tsx` - Auto-pause IA
- `components/livechat/message-item.tsx` - Feedback buttons
- `components/livechat/conversation-header.tsx` - Botão resumo
- `app/api/n8n/send-message/route.ts` - Auto-pause logic

**Layout:**
- `app/(dashboard)/layout.tsx` - Ajustes de sidebar
- `components/layout/app-sidebar.tsx` - Nova rota `/crm` e `/perfil`

**Outros:**
- `lib/hooks/use-realtime-contact-list.ts` - Bug fix preview mensagens
- `.env.local.example` - Variáveis de ambiente adicionadas

### Commits Relevantes (10+ commits)

| Data | Hash | Descrição |
|------|------|-----------|
| Nov 27 | `68be911` | Corrigido bug da logo |
| Nov 27 | `6cb3440` | Melhorado UI dos balões de mensagens |
| Nov 27 | `c12ec1e` | Lógica de loading corrigida |
| Nov 27 | `b8f9713` | Melhorado O UX |
| Nov 27 | `d1e1f78` | Layout do header da conversa modificado |
| Nov 26 | `70f9936` | Logo adicionada à página de login |
| Nov 26 | `0b4a8e3` | Filtro ativo como padrão no livechat |
| Nov 26 | `2b7d59c` | Implementado quick reply shortcut |
| Nov 26 | `749e943` | Implementado pause IA |
| Nov 25 | `4c9feeb` | Implementada resumo da conversa |
| Nov 24 | `19bff54` | Implementado CRM beta |
| Nov 23 | `f4869fa` | Neurocore utilizando n8n |
| Nov 23 | `927b2b8` | Integrado webhook n8n de producao |
| Nov 23 | `3aea276` | Improved message feedback UX |
| Nov 23 | `976c4ed` | Improved quick replies |
| Nov 23 | `1a4e25d` | Auto-pause IA when attendant sends message |

### Regras de Negócio Implementadas

**Auto-Pause IA:**
1. Atendente envia mensagem → IA pausa automaticamente
2. Badge muda para "IA Pausada" (amarelo)
3. Atendente pode retomar IA manualmente quando terminar

**AI Global Pause:**
1. Admin acessa `/perfil`
2. Clica switch "Pausar IA Globalmente"
3. Modal exige digitar "PAUSAR" para confirmar
4. Sistema atualiza `tenants.ai_paused = true`
5. n8n ignora TODAS mensagens do tenant
6. Conversas continuam abertas, mas IA não responde

**Quick Replies:**
1. Atendente digita "/" no input → Painel abre
2. Busca ou scroll para encontrar reply
3. Click na reply → Insere no input
4. Sistema incrementa `usage_count` automaticamente
5. Replies com maior `usage_count` recebem badge "Mais Usada"

**CRM Kanban:**
1. Cada tag = 1 coluna no board
2. Conversas podem ter múltiplas tags
3. Card aparece em todas as colunas das tags associadas
4. Filtros por status (open/paused/closed) + busca

### Princípios SOLID Aplicados

**Single Responsibility:**
- `QuickReplyCommand`: Apenas detecta "/" e abre painel
- `MessageFeedbackButtons`: Apenas renderiza botões feedback
- `AIControl`: Apenas gerencia pause global da IA
- `CRMKanbanBoard`: Apenas orquestra layout do board

**Open/Closed:**
- Quick replies extensíveis via CRUD (sem modificar código)
- Tags customizáveis por tenant (sem modificar estrutura)
- Componentes extensíveis via callbacks

**Dependency Inversion:**
- Componentes dependem de abstrações (callbacks, queries)
- API routes abstraem lógica de n8n
- Queries abstraem acesso ao Supabase

### Decisões Técnicas

**Quick Replies - Comando "/" (Decisão #014):**
- Por quê: Atalho rápido, padrão conhecido (Slack, Discord), não intrusivo
- Trade-off: Curva de aprendizado vs Velocidade → Velocidade vence

**Message Feedback - Hover (Decisão #015):**
- Por quê: UI clean, padrão conhecido (ChatGPT), feedback específico
- Trade-off: Descobribilidade vs UI limpa → UI limpa vence

**CRM - Tags Many-to-Many (Decisão #016):**
- Por quê: Múltiplas tags por conversa, flexível, escalável
- Trade-off: Simplicidade vs Flexibilidade → Flexibilidade vence

**Conversation Summary - Modal (Decisão #017):**
- Por quê: Acesso rápido, não polui UI permanentemente
- Trade-off: Visibilidade vs Espaço UI → Espaço vence

**AI Global Pause - Confirmação (Decisão #018):**
- Por quê: Seguro, evita acidentes, crítico para emergências
- Trade-off: Velocidade vs Segurança → Segurança vence

**Auto-Pause IA - Automático (Decisão #019):**
- Por quê: Evita conflito IA+humano, UX fluida
- Trade-off: Controle explícito vs Automação → Automação vence

**Tags System - Configurável (Decisão #020):**
- Por quê: Flexível, cada tenant customiza suas tags
- Trade-off: Simplicidade vs Customização → Customização vence

### Métricas

- **Arquivos criados**: 37
- **Arquivos modificados**: 15+
- **Componentes criados**: 14
- **API routes criadas**: 7
- **Queries criadas**: 12+ funções
- **Migrações SQL**: 6
- **Commits**: 30+ em 15 dias
- **Linhas de código**: ~3000 (componentes + API + queries)
- **Documentação**: ~2500 linhas (decisões + BACKLOG)
- **Features completas**: 8 grandes features
- **Build time**: Estável em ~14-18s
- **Type-check**: ✅ Zero erros
- **ESLint**: ✅ Zero erros

### Gaps do MVP Resolvidos

| Gap | Descrição | Status |
|-----|-----------|--------|
| **Gap #3** | Feedback de mensagens | ✅ **RESOLVIDO** (Message Feedback) |
| **Gap #4** | Respostas Rápidas | ✅ **RESOLVIDO** (Quick Replies) |
| **Novo** | CRM para organização | ✅ **IMPLEMENTADO** |
| **Novo** | Profile page | ✅ **IMPLEMENTADO** |
| **Novo** | AI pause control | ✅ **IMPLEMENTADO** |

### Próximos Passos (Prioridade Alta)

1. **Agent Templates UI** - Implementar interface para gerenciar templates (contexto/fluxo-edicao-prompts-tenant.md)
2. **Dashboard/Analytics** - KPIs, gráficos, métricas de performance
3. **Cards por Conversa** - Refatoração (Decisão #013 - LIVECHAT_CONVERSATION_CARDS_REFACTOR.md)
4. **Drag-and-drop CRM** - Finalizar funcionalidade no Kanban
5. **Testes E2E** - Cobertura de fluxos críticos

### Próximos Passos (Prioridade Média)

- Refatorar SynapseDialog para reutilização no Neurocore
- Implementar retry automático para mensagens falhadas
- Job periódico para cleanup de mensagens pending órfãs
- Webhook WhatsApp para atualizar `status='read'`
- Adicionar paginação em bases com >50 synapses
- Melhorar empty states com call-to-action

### Bloqueios/Problemas Resolvidos

- ✅ Preview de mensagens não atualizava via Realtime → Query adicional para buscar mensagem completa
- ✅ Sidebar expandia ao sair do livechat → Hook refatorado com useRef
- ✅ Conversas "sumindo" → Identificado problema arquitetural (cards por contato vs conversa)
- ✅ Scroll horizontal na página toda → Adicionado `w-full overflow-x-hidden`
- ✅ Confirmação de AI pause muito perigosa → Adicionada validação "PAUSAR"

---

## Sessão 2025-11-19 (Tarde) - Refatoração Master-Detail + Webhooks N8N

### Completado
- [x] Criar plano detalhado KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md (736 linhas)
- [x] Documentar Decisão #010 em DECISIONS.md
- [x] Sprint 1: Remover 3 componentes antigos (modal aninhado)
- [x] Sprint 2: Criar 4 componentes novos (master-detail)
- [x] Sprint 3: Adicionar webhooks N8N para embeddings
- [x] Sprint 4: Atualizar página principal
- [x] Sprint 5: Executar testes (type-check, build) - Sucesso
- [x] Sprint 6: Atualizar documentação (DECISIONS.md, PROGRESS.md)

### Funcionalidades Implementadas

**Layout Master-Detail:**
- ✅ Scroll horizontal de cards (BaseConhecimentoCarousel)
- ✅ Card individual com highlight quando selecionado
- ✅ Badge com contador de synapses
- ✅ Toggle Ativa/Desativa em cada card
- ✅ Tabela de synapses exibida abaixo ao selecionar base
- ✅ Modal simples para criar/editar base (sem synapses aninhadas)
- ✅ Empty state quando não há bases
- ✅ Loading state ao carregar synapses

**Integração N8N:**
- ✅ Helper function para webhooks (`lib/utils/n8n-webhooks.ts`)
- ✅ Modo mock configurável via `N8N_MOCK=true`
- ✅ 4 webhooks implementados:
  - Sync Synapse (create/update) → gera embeddings
  - Delete Synapse Embeddings → remove embeddings
  - Toggle Synapse Embeddings → ativa/desativa embeddings
  - Inactivate Base → inativa base (synapses inacessíveis)
- ✅ Error handling robusto (webhooks não bloqueiam CRUD)
- ✅ Timeout de 10s para cada webhook
- ✅ Logs detalhados para debug

**Regras de Negócio:**
- ✅ Base inativa → todas synapses ficam inacessíveis
- ✅ Synapse desativada → webhook remove embeddings
- ✅ Delete de base → apenas soft delete (toggle inactive)
- ✅ Webhooks assíncronos (não bloqueiam UI)

### Arquivos Criados
- `components/knowledge-base/base-conhecimento-card.tsx` - Card individual
- `components/knowledge-base/base-conhecimento-carousel.tsx` - Scroll horizontal
- `components/knowledge-base/base-conhecimento-form-dialog.tsx` - Modal simples
- `components/knowledge-base/knowledge-base-master-detail.tsx` - Orquestrador
- `lib/utils/n8n-webhooks.ts` - Helper + types para webhooks
- `docs/KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md` - Plano completo (736 linhas)

### Arquivos Deletados
- `components/knowledge-base/base-conhecimento-dialog.tsx` - Modal aninhado antigo
- `components/knowledge-base/base-conhecimento-table.tsx` - DataTable antiga
- `components/knowledge-base/knowledge-base-container.tsx` - Orquestrador antigo

### Arquivos Modificados
- `components/knowledge-base/index.ts` - Exports atualizados
- `app/(dashboard)/knowledge-base/page.tsx` - Usa KnowledgeBaseMasterDetail
- `app/actions/synapses.ts` - Adicionadas 4 chamadas de webhook
- `app/actions/base-conhecimento.ts` - Adicionada 1 chamada de webhook
- `.env.local.example` - Variáveis N8N + flag N8N_MOCK
- `DECISIONS.md` - Decisão #010 adicionada

### Componentes Reutilizados (sem modificar)
- `SynapsesTable` - Já tinha callbacks perfeitos
- `SynapseDialog` - Já tinha onSuccess callback
- `DeleteSynapseDialog` - Já funcionava
- `SynapseActions` - Já passava callbacks

### Princípios SOLID Aplicados
**Single Responsibility:**
- Cada componente tem responsabilidade única e clara
- BaseConhecimentoCard: apenas renderiza card
- BaseConhecimentoCarousel: apenas layout de scroll
- BaseConhecimentoFormDialog: apenas form de base
- KnowledgeBaseMasterDetail: apenas orquestra estado

**Open/Closed:**
- Componentes extensíveis via callbacks
- Fechados para modificação (lógica interna estável)

**Dependency Inversion:**
- Componentes dependem de callbacks abstratos
- Não dependem de router.refresh (usar callbacks)
- Queries abstraídas em lib/queries

### Decisões Técnicas
- **Layout Master-Detail**: Alinha 100% com wireframe do usuário
- **Webhooks N8N**: Integração real para vetorização de synapses
- **Modo mock N8N**: Desenvolvimento sem dependência de N8N estar configurado
- **Error handling**: Webhooks não bloqueiam CRUD (logs + continue)
- **Estado local**: Refetch synapses ao trocar base (simplicidade MVP)
- **Callbacks**: onSuccess, onSynapseChange para refresh sem fechar modal

### Variáveis de Ambiente Adicionadas
```bash
# Webhooks N8N
N8N_DELETE_SYNAPSE_EMBEDDINGS_WEBHOOK=/webhook/livia/delete-synapse-embeddings
N8N_TOGGLE_SYNAPSE_EMBEDDINGS_WEBHOOK=/webhook/livia/toggle-synapse-embeddings
N8N_INACTIVATE_BASE_WEBHOOK=/webhook/livia/inactivate-base

# Mock Mode
N8N_MOCK=true  # Modo mock para desenvolvimento
```

### Bloqueios/Problemas Resolvidos
- ✅ Button importado mas não usado → Removido import
- ✅ Nome incorreto de action → toggleBaseConhecimentoActiveAction
- ✅ TypeScript errors → Corrigidos (type-check passou)
- ✅ Build errors → Nenhum (build passou)
- ✅ **Scroll horizontal na página toda** → Sidebar influenciava largura total
  - Solução: Adicionado `w-full overflow-x-hidden` no SidebarInset e todos containers
  - Arquivos: layout.tsx, page.tsx, master-detail.tsx, carousel.tsx
- ✅ **Toggle da sidebar não funcionava** → Hook forçava estado continuamente
  - Solução: Refatorado hook com useRef para detectar mudança de rota
  - Arquivo: use-sidebar-auto-collapse.ts
  - Comportamento: Agora permite toggle manual sem interferência do hook

### Métricas
- **Arquivos criados**: 5
- **Arquivos deletados**: 3
- **Arquivos modificados**: 10 (6 iniciais + 4 correções finais)
- **Componentes criados**: 4 (master-detail)
- **Webhooks implementados**: 4
- **Linhas de código**: ~800 (componentes + webhooks + types)
- **Documentação**: ~900 linhas (plano + decisão)
- **Build time**: 14.1s (melhor que antes: 18.4s)
- **Type-check**: ✅ Zero erros
- **ESLint**: ✅ Zero erros
- **Tempo total**: ~3 horas (plano + implementação + testes + docs)

### Próximos Passos
1. ✅ **Refatoração Master-Detail** - COMPLETO
2. Testar layout manualmente (aguarda ambiente dev)
3. Configurar webhooks N8N reais (trocar N8N_MOCK=false)
4. Feedback de Mensagens no Livechat (like/dislike em balões)
5. Respostas Rápidas no Livechat (comando "/" + sheet)
6. Dashboard (KPIs, gráficos)

---

## Sessão 2025-11-19 (Manhã) - Implementação do Treinamento Neurocore

### Completado
- [x] Analisar MVP descrito vs implementado (análise de contraste)
- [x] Criar plano detalhado de implementação (400+ linhas)
- [x] Instalar dependências (react-markdown, remark-gfm, uuid, sonner)
- [x] Criar types completos para Neurocore
- [x] Implementar API route com modo mock configurável
- [x] Implementar Server Action para feedback
- [x] Criar 5 componentes (NeurocoreChat, TrainingQueryInput, etc.)
- [x] Integrar componentes na página Neurocore
- [x] Adicionar error handling e loading states
- [x] Executar testes (type-check, lint, build) - Sucesso
- [x] Documentar decisão #008 em DECISIONS.md
- [x] Atualizar PROGRESS.md

### Funcionalidades Implementadas

**Treinamento Neurocore:**
- ✅ Interface de chat para testar conhecimento da IA
- ✅ API route com modo mock (desenvolvimento sem n8n)
- ✅ Renderização de respostas em markdown (seguro)
- ✅ Cards de synapses usadas com score de similaridade
- ✅ Progress bar visual para score (0-100%)
- ✅ Feedback like/dislike com comentário opcional
- ✅ Auto-scroll para última resposta
- ✅ Empty state amigável
- ✅ Loading states animados
- ✅ Error handling robusto
- ✅ Timeout de 30s para n8n
- ✅ Limite de 20 queries no histórico (performance)

**Arquitetura:**
- ✅ Estado local das queries (não persiste no banco)
- ✅ Modo mock configurável via `NEUROCORE_MOCK=true`
- ✅ Simulação de latência realista (2-3s)
- ✅ Feedback salvo em `message_feedbacks` (JSON context)
- ✅ Validação: min 3 chars, max 500 chars
- ✅ Ctrl+Enter para enviar pergunta

### Arquivos Criados
- `types/neurocore.ts` - Types completos (TrainingQuery, TrainingResponse, etc.)
- `app/api/neurocore/query/route.ts` - API route com mock
- `app/actions/neurocore.ts` - Server Action para feedback
- `components/neurocore/neurocore-chat.tsx` - Container principal
- `components/neurocore/training-query-input.tsx` - Form de pergunta
- `components/neurocore/training-response-card.tsx` - Card de resposta
- `components/neurocore/synapse-used-card.tsx` - Card de synapse
- `components/neurocore/response-feedback-dialog.tsx` - Modal de feedback
- `components/neurocore/index.ts` - Barrel export
- `.env.local.example` - Variáveis de ambiente documentadas
- `docs/NEUROCORE_PLAN.md` - Plano detalhado (400 linhas)
- `docs/MVP_CONTRAST_ANALYSIS.md` - Análise de gaps (600 linhas)

### Arquivos Modificados
- `app/(dashboard)/neurocore/page.tsx` - Integração do NeurocoreChat
- `package.json` - Adicionadas dependências

### Bibliotecas Adicionadas
- `react-markdown` (12M downloads/semana) - Renderizar respostas
- `remark-gfm` - GitHub Flavored Markdown
- `uuid` + `@types/uuid` - IDs locais de queries
- `sonner` - Toast notifications (substitui toast deprecated)
- shadcn/ui: `progress`, `label`, `separator`

### Próximos Passos (Priorizados)
1. **Refatorar Base de Conhecimento** (hierarquia bases → synapses)
2. **Feedback de Mensagens** no Livechat (like/dislike em balões)
3. **Respostas Rápidas** no Livechat (comando "/" + sheet)
4. **Refatorar SynapseDialog** para reutilização no Neurocore
5. Dashboard (KPIs, gráficos)
6. Personalização NeuroCore

### Decisões Técnicas
- **Modo mock**: Desenvolvimento frontend independente do n8n (trocar flag quando pronto)
- **Estado local**: Queries não persistem no banco (simplicidade MVP)
- **react-markdown**: Padrão de mercado, seguro (whitelist de componentes)
- **Sonner**: Toast modern (shadcn/ui recomenda sobre toast deprecated)
- **Limitar histórico**: 20 queries no estado (evita problemas de performance)
- **Type assertion**: `message_feedbacks` não está no tipo gerado (aceito temporariamente)

### Gaps Identificados (MVP Descrito vs Implementado)
🔴 **Gap Crítico #1**: Base de Conhecimento sem hierarquia
- Implementamos CRUD de synapses direto
- MVP pede: Bases → Synapses relacionadas
- Impacto: Arquitetura diverge, precisa refactor

⚠️ **Gap #2**: Livechat - Layout pode estar divergente
- Implementado: 3 colunas
- MVP descrito: 4 colunas (Contatos | Conversas | Interações | Dados)

⚠️ **Gap #3**: Feedback de mensagens ausente
- Like/dislike no header da conversa
- Hover thumb-up/down em balões

⚠️ **Gap #4**: Respostas Rápidas ausentes
- Botão lightning-bolt (10 mais usadas)
- Comando "/" no input
- Sheet de gerenciamento

### Bloqueios/Problemas Resolvidos
- ✅ `use-toast` deprecated → Migrado para `sonner`
- ✅ `message_feedbacks` não no tipo → Type assertion temporário
- ✅ `tenant_id` pode ser null → Validação explícita
- ✅ Variável não usada no mock → Prefixada com `_`
- ✅ Import não usado → Removido

### Métricas
- **Arquivos criados**: 11
- **Componentes criados**: 5
- **Linhas de código**: ~1500 (componentes + API + types)
- **Documentação**: 1000+ linhas (planos + análise)
- **Build time**: 20.7s
- **Type-check**: ✅ Zero erros
- **Testes manuais**: Pendentes (aguardando setup do ambiente)

---

## Sessão 2025-11-18 - Implementação de Sidebar com Auto-Collapse

### Completado
- [x] Consultar documentação atualizada do shadcn/ui sidebar
- [x] Instalar componente sidebar do shadcn/ui
- [x] Criar hook customizado `useSidebarAutoCollapse` seguindo SOLID
- [x] Criar route groups `(auth)` e `(dashboard)`
- [x] Implementar componente AppSidebar com navegação
- [x] Criar layout do dashboard com SidebarProvider
- [x] Mover páginas existentes para route groups apropriados
- [x] Criar páginas placeholder (Knowledge Base, Neurocore)
- [x] Corrigir bug: sidebar expande ao sair do livechat
- [x] Executar testes de tipo (TypeScript) - Zero erros
- [x] Executar ESLint - Zero erros nos arquivos novos
- [x] Build production - Sucesso
- [x] Documentar decisão #006 em DECISIONS.md

### Funcionalidades Implementadas

**Sidebar de Navegação:**
- ✅ Componente shadcn/ui sidebar profissional
- ✅ Auto-collapse no `/livechat` (modo icon)
- ✅ Auto-expand ao sair do livechat
- ✅ 3 items de navegação (Livechat, Knowledge Base, Neurocore)
- ✅ Persistência de estado via cookies
- ✅ Keyboard shortcuts (Ctrl+B / Cmd+B)
- ✅ Acessibilidade completa (ARIA labels)
- ✅ Animações suaves de transição
- ✅ SidebarTrigger no header

**Arquitetura:**
- ✅ Route Groups: `(auth)` e `(dashboard)`
- ✅ Hook customizado: `useSidebarAutoCollapse`
- ✅ Wrapper Component para Server Components
- ✅ Layout unificado no dashboard

### Arquivos Criados
- `lib/hooks/use-sidebar-auto-collapse.ts` - Hook de auto-collapse
- `lib/hooks/index.ts` - Export barrel
- `components/layout/app-sidebar.tsx` - Sidebar principal
- `components/layout/nav-items.tsx` - Configuração de navegação
- `components/layout/sidebar-auto-collapse-wrapper.tsx` - Wrapper client
- `components/layout/index.ts` - Export barrel
- `app/(dashboard)/layout.tsx` - Layout com SidebarProvider
- `app/(dashboard)/livechat/page.tsx` - Livechat ajustado
- `app/(dashboard)/knowledge-base/page.tsx` - Placeholder
- `app/(dashboard)/neurocore/page.tsx` - Placeholder
- `app/(auth)/login/page.tsx` - Movido de app/login

### Arquivos Modificados
- `components/auth/header.tsx` - Adicionado SidebarTrigger + Separator
- `components/ui/sidebar.tsx` - Corrigido Math.random → useState
- `app/page.tsx` - Redirect para /livechat

### Próximos Passos
- [ ] Implementar Base de Conhecimento (CRUD de synapses)
- [ ] Implementar Treinamento Neurocore
- [ ] Adicionar testes E2E
- [ ] Corrigir RLS da tabela users (BACKLOG-001)

### Decisões Técnicas
- **shadcn/ui Sidebar**: Escolhido por acessibilidade, animações e keyboard shortcuts
- **Hook customizado**: `useSidebarAutoCollapse` aplica lógica baseada em rota
- **Route Groups**: Organiza rotas autenticadas vs públicas
- **Auto-collapse bidirecional**: Colapsa no livechat, expande ao sair
- **Princípios SOLID**: Single Responsibility, Open/Closed, Dependency Inversion

### Bloqueios/Problemas
- ✅ Bug corrigido: Sidebar não expandia ao sair do livechat
- ✅ ESLint warning: Fragment desnecessário (corrigido)
- ✅ Math.random em render (corrigido para useState)

---

## Sessão 2025-11-17 (Parte 2) - Implementação Completa do Livechat

### Completado
- [x] Corrigir bugs no Livechat (naming inconsistente em payloads)
- [x] Implementar API routes para controle de conversas:
  - `/api/conversations/pause` - Pausar conversa completa
  - `/api/conversations/resume` - Retomar conversa pausada
  - `/api/conversations/reopen` - Reabrir conversa encerrada
  - `/api/conversations/pause-ia` - Pausar IA (já existia, corrigido)
  - `/api/conversations/resume-ia` - Retomar IA (já existia, corrigido)
- [x] Expandir ConversationControls com controles de conversa
- [x] Adicionar indicadores visuais de status (badges coloridos)
- [x] Implementar confirmação para reabrir conversas encerradas
- [x] Validar todas as regras de negócio:
  - Não pausar conversa já pausada
  - Não pausar conversa encerrada
  - Não retomar conversa já ativa
  - Reabrir apenas conversas encerradas
  - Desabilitar controles de IA quando conversa pausada
- [x] Verificação de tipos TypeScript (passou sem erros)

### Funcionalidades do Livechat Implementadas

**Interface de Usuário:**
- ✅ Lista de contatos com conversas ativas
- ✅ Visualização de mensagens em tempo real
- ✅ Envio de mensagens manuais
- ✅ Controles de status da conversa (Aberta/Pausada/Encerrada)
- ✅ Controles de IA (Ativa/Pausada)
- ✅ Auto-scroll nas mensagens
- ✅ Badges coloridos indicando status
- ✅ Loading states durante operações

**Backend:**
- ✅ 5 API Routes implementadas
- ✅ Integração com webhooks n8n
- ✅ Validação de autenticação e tenant
- ✅ Tratamento de erros robusto
- ✅ Realtime Supabase funcionando

**Fluxos Completos:**
- ✅ Pausar conversa → IA desativa → UI atualiza
- ✅ Retomar conversa → IA reativa → UI atualiza
- ✅ Reabrir conversa encerrada → Confirmação → IA reativa
- ✅ Pausar IA específica → Conversa continua aberta
- ✅ Retomar IA → IA volta a responder
- ✅ Nova mensagem → Realtime → UI atualiza automaticamente

### Arquivos Modificados
- `components/livechat/conversation-controls.tsx` - Expandido com novos controles
- `components/livechat/message-input.tsx` - Corrigido naming de payload
- `app/api/conversations/pause/route.ts` - Criado
- `app/api/conversations/resume/route.ts` - Criado
- `app/api/conversations/reopen/route.ts` - Criado
- `BACKLOG.md` - Atualizado (Realtime marcado como concluído)

### Próximos Passos
- [ ] Implementar Base de Conhecimento (CRUD de synapses)
- [ ] Implementar Treinamento Neurocore
- [ ] Adicionar testes E2E
- [ ] Melhorar tratamento de erros com toast notifications
- [ ] Corrigir RLS da tabela users (BACKLOG-001)

### Decisões Técnicas
- **Separação de controles**: Conversa e IA são controladas separadamente
- **Confirmação para ações críticas**: Reabrir conversa encerrada requer confirmação
- **Desabilitar controles contextualmente**: IA não pode ser controlada se conversa pausada
- **Webhooks n8n**: Todas operações críticas passam pelo n8n para consistência
- **Realtime completo**: Mensagens e estado da conversa atualizam automaticamente

### Bloqueios/Problemas
- **RLS Users**: Ainda usando workaround com admin client (não bloqueante)
- **Webhooks n8n**: URLs ainda não configuradas (desenvolvimento local pendente)

---

## Sessão 2025-11-17 (Parte 1) - Setup do Projeto Next.js 15

### Completado
- [x] Criar projeto Next.js 15 com App Router
- [x] Configurar TypeScript strict mode com regras extras
- [x] Configurar ESLint rigoroso com limite de 200 linhas
- [x] Instalar e configurar Husky + lint-staged para pre-commit hooks
- [x] Instalar dependências do Supabase (@supabase/supabase-js, @supabase/ssr)
- [x] Instalar e configurar shadcn/ui
- [x] Instalar componentes essenciais (Button, Input, Card, Avatar, Badge, etc)
- [x] Criar estrutura de pastas modularizada
- [x] Criar Supabase client para Client Components
- [x] Criar Supabase client para Server Components
- [x] Criar n8n webhook client base
- [x] Criar template de variáveis de ambiente (.env.local.example)
- [x] Criar types placeholder para database
- [x] Criar documentação de setup (SETUP.md)
- [x] Inicializar git no projeto

### Configurações Aplicadas

**TypeScript Strict Mode:**
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`
- `forceConsistentCasingInFileNames: true`

**ESLint Rigoroso:**
- `max-lines: 200` (warning) - Previne arquivos grandes
- `@typescript-eslint/no-explicit-any: error` - Proíbe uso de `any`
- `@typescript-eslint/no-unused-vars: error` - Variáveis não usadas
- `no-console: warn` (permite console.warn e console.error)
- `prefer-const: error`
- `no-var: error`
- `react-hooks/exhaustive-deps: error`

**Estrutura de Pastas:**
```
app/
├── api/{n8n,supabase}/
├── components/{livechat,knowledge-base,neurocore,shared,ui}/
├── lib/{supabase,n8n,utils,hooks}/
└── types/
```

**Dependências Instaladas:**
- next@16.0.3
- react@19.2.0
- @supabase/supabase-js
- @supabase/ssr
- lucide-react
- shadcn/ui components
- husky@9.1.7
- lint-staged@16.2.6

### Próximos Passos (Pendentes)
- [ ] Criar arquivo .env.local com credenciais reais
- [ ] Rodar migração 001_schema_improvements_mvp_whatsapp.sql no Supabase
- [ ] Gerar tipos TypeScript do Supabase (`npx supabase gen types`)
- [ ] Criar primeiras API Routes para n8n webhooks
- [ ] Implementar componentes do Livechat (ContactList, ConversationView, MessageInput)
- [ ] Configurar Supabase Realtime subscriptions
- [ ] Implementar autenticação

### Decisões Técnicas
- **Max 200 linhas por arquivo**: Configurado como warning no ESLint para incentivar modularização
- **Sem uso de `any`**: TypeScript strict impede uso de tipos implícitos
- **Pre-commit hooks**: Previne commits com erros de tipo ou lint
- **Estrutura modular**: Pastas separadas por feature/responsabilidade

### Bloqueios/Problemas
Nenhum bloqueio identificado. Setup pronto para desenvolvimento.

---

## Sessão 2025-11-16 (Parte 2) - Ajustes na Arquitetura de Dados

### Completado
- [x] Revisar migração SQL e identificar necessidade de ajustes
- [x] Remover tabela `synapse_embeddings` da migração (base vetorial gerenciada pelo n8n)
- [x] Renumerar seções da migração SQL (v2)
- [x] Atualizar resumo final da migração
- [x] Documentar decisão arquitetural (#003) sobre base vetorial
- [x] Atualizar CONTEXT.md com nova arquitetura de embeddings
- [x] Remover referências a pgvector do CONTEXT.md

### Decisão Tomada
**Base Vetorial no n8n**: A tabela `synapse_embeddings` foi removida do Supabase. O n8n gerencia toda a lógica de embeddings:
- Criação de embeddings ao publicar synapses
- Armazenamento em base vetorial externa
- Busca semântica durante processamento de IA

**Frontend apenas:**
- CRUD de synapses
- Controle de estados e flags
- Disparo de webhooks para publicação

### Bloqueios/Problemas
Nenhum bloqueio identificado.

---

## Sessão 2025-11-16 (Parte 1) - Setup Completo e Documentação Técnica

### Completado
- [x] Criar estrutura de documentação do projeto (CONTEXT, PROGRESS, DECISIONS)
- [x] Criar skill customizada LIVIA (estrutura híbrida)
- [x] Criar arquivo n8n-reference.md (8KB de padrões e exemplos)
- [x] Criar arquivo supabase-reference.md (13KB de queries e realtime)
- [x] Criar arquivo frontend-reference.md (13KB de Next.js e shadcn/ui)
- [x] Criar arquivo states-and-flows.md (estados, transições, diagramas)
- [x] Criar arquivo webhooks-livia.md (todos os webhooks específicos)
- [x] Documentar decisão sobre não usar MCP no MVP
- [x] Documentar decisão sobre estrutura híbrida de skills
- [x] Analisar schema do banco de dados (prós/contras detalhados)
- [x] Criar SQL de migração 001_schema_improvements_v2.sql (versão idempotente)
- [x] Criar database-schema.md (documentação completa do schema)
- [x] Gerar tipos TypeScript (arquivo de exemplo)
- [x] Atualizar CONTEXT.md com detalhes reais do projeto (3 telas, synapses, etc)
- [x] Atualizar SKILL.md com novas referências
- [x] Atualizar PROGRESS.md com sessão completa
- [x] Corrigir erro de idempotência na migração SQL

### Pendente (Próxima Sessão)
- [ ] Criar projeto Next.js 15 com App Router
- [ ] Configurar Supabase (client/server)
- [ ] Rodar migração 001_schema_improvements_v2.sql no Supabase
- [ ] Gerar tipos TypeScript com `npx supabase gen types`
- [ ] Configurar shadcn/ui
- [ ] Criar estrutura de pastas do projeto
- [ ] Configurar variáveis de ambiente (.env.local)
- [ ] Criar primeiros componentes (Livechat, Base Conhecimento)

### Bloqueios/Problemas
Nenhum bloqueio identificado.

---

## Histórico de Sessões

### Sessão 2025-11-16 - Setup Inicial
**Foco:** Estrutura de trabalho, skills customizadas e decisões arquiteturais

**Completado:**
- [x] Estrutura de documentação (CONTEXT, PROGRESS, DECISIONS)
- [x] Skill LIVIA com estrutura híbrida (1 skill + 3 referências)
- [x] Análise de prós/contras sobre uso de MCP
- [x] Decisão de não usar MCP no MVP
- [x] Documentação completa de padrões (n8n, Supabase, Frontend)

**Aprendizados:**
- Estrutura híbrida de skills é ideal para projetos complexos (economia de tokens + contexto unificado)
- MCP adiciona complexidade que não se justifica no MVP
- Documentar decisões arquiteturais desde o início facilita onboarding
- Claude Code skills com arquivos de referência funcionam como "documentação executável"
- Analisar schema ANTES de começar a codar evita retrabalho
- Documentar estados e fluxos previne bugs de lógica de negócio
- Webhooks bem especificados facilitam integração com n8n

**Decisões Tomadas:**
- Adiar MCP para pós-MVP
- Usar estrutura híbrida de skills (SKILL.md + referências)
- shadcn/ui para componentes UI
- Server Components por padrão
- Melhorias críticas no schema (content em synapses, tabela de embeddings, etc)

**Problemas Encontrados no Schema:**
- Falta campo `content` em synapses (CORRIGIDO na migração)
- Falta tabela `synapse_embeddings` para base vetorial (CRIADO)
- Falta rastreamento de pausa de IA por usuário (CORRIGIDO)
- Falta tipo `system` em message_sender_type (CORRIGIDO)
- `users.id` não estava linkado com `auth.users` (CORRIGIDO)

**Problemas Encontrados na Migração:**
- Erro "constraint already exists" ao executar migração múltiplas vezes
- Causa: `CREATE TABLE IF NOT EXISTS` com constraints inline cria constraints mesmo quando tabela existe
- Solução: Migração v2 com verificação individual de cada constraint via pg_constraint
- Status: CORRIGIDO (001_schema_improvements_v2.sql é totalmente idempotente)

---

## Métricas
- **Skills criadas:** 1 (livia-mvp)
- **Arquivos de referência:** 5 (n8n, supabase, frontend, states, webhooks)
- **Documentação criada:** 3 arquivos (database-schema.md, types-example.ts, migração SQL)
- **Decisões documentadas:** 2 (MCP, Skills)
- **Melhorias no schema:** 10 (detalhadas na migração)
- **Webhooks mapeados:** 9 (send-message, sync-synapse, neurocore-query, etc)
- **Total de componentes criados:** 0 (próxima sessão)
- **Testes implementados:** 0 (próxima sessão)
- **Protótipos validados:** 0 (próxima sessão)

---

## Sessão: 2025-11-19 (Continuação - Hierarquia Base de Conhecimento)

**Foco:** Implementação de hierarquia Base de Conhecimento → Synapses (Gap #1 do MVP)

**Completado:**
- [x] Sprint 1: Types, Queries e Server Actions para Base de Conhecimento
  - Criados 6 tipos (BaseConhecimento, BaseConhecimentoWithCount, etc.)
  - Criadas 9 queries (getBaseConhecimentos, createBaseConhecimento, etc.)
  - Criadas 4 Server Actions (create, update, delete, toggle)
- [x] Sprint 2: Componentes UI com Modal Aninhado
  - BaseConhecimentoTable (lista de bases)
  - BaseConhecimentoDialog (form + synapses aninhadas)
  - KnowledgeBaseContainer (client wrapper para estado)
  - Refatorado SynapsesTable, SynapseDialog, DeleteSynapseDialog (callbacks onSuccess)
- [x] Sprint 3: Integração e Migração
  - Refatorado /knowledge-base page para usar hierarquia
  - Criado API route /api/bases/[baseId]/synapses (client component fetch)
  - Criado script SQL de migração (base padrão + reassign synapses órfãs)
- [x] Sprint 4: Validações (já implementadas nos componentes)
- [x] Sprint 5: Testes e Documentação
  - ✅ TypeScript type-check
  - ✅ Build production (18.4s)
  - ✅ Decisão #009 documentada
  - ✅ 3 decisões rápidas adicionadas

**Aprendizados:**
- Modal aninhado funciona bem com shadcn/ui (portals gerenciam z-index)
- Callbacks (onSuccess, onSynapseChange) permitem UX fluida sem fechar modal
- Client components não podem usar queries de server.ts → usar API routes
- JOIN com count evita N+1 queries (getBaseConhecimentos)
- Migração SQL idempotente é crítica (verificações IF NOT EXISTS)
- SOLID aplicado previne refactors grandes (componentes reutilizáveis)

**Decisões Tomadas:**
- Modal Aninhado (vs Subrotas ou Accordion) - alinha MVP, 12-15h
- Callbacks para refresh local (vs router.refresh que perde contexto)
- API route para fetch de synapses (client component limitation)
- shadcn/ui Select component adicionado

**Problemas Encontrados e Resolvidos:**
1. **Build Error: Client component importing server queries**
   - Problema: BaseConhecimentoDialog importava getSynapsesByBase que usa createClient(server.ts)
   - Causa: next/headers só funciona em Server Components
   - Solução: Criada API route /api/bases/[baseId]/synapses, client usa fetch()

2. **Select component não instalado**
   - Problema: Import error em BaseConhecimentoDialog
   - Solução: `npx shadcn@latest add select`

3. **Unused request parameter**
   - Problema: TypeScript error em API route
   - Solução: Prefixado com `_request`

**Arquivos Criados (Total: 8):**
- types/knowledge-base.ts (6 novos tipos)
- lib/queries/knowledge-base.ts (9 queries)
- app/actions/base-conhecimento.ts (4 Server Actions)
- components/knowledge-base/base-conhecimento-table.tsx
- components/knowledge-base/base-conhecimento-dialog.tsx
- components/knowledge-base/knowledge-base-container.tsx
- app/api/bases/[baseId]/synapses/route.ts
- migrations/base-conhecimento-hierarchy.sql

**Arquivos Modificados (Total: 6):**
- app/(dashboard)/knowledge-base/page.tsx (refatorado para hierarquia)
- components/knowledge-base/synapses-table.tsx (callback onSynapseChange)
- components/knowledge-base/synapse-dialog.tsx (callback onSuccess)
- components/knowledge-base/delete-synapse-dialog.tsx (callback onSuccess)
- components/knowledge-base/synapse-actions.tsx (passa callbacks)
- components/knowledge-base/index.ts (exports)

**SOLID Aplicado:**
- **SRP**: Cada componente tem responsabilidade única
- **OCP**: Componentes extensíveis via callbacks, fechados para modificação
- **LSP**: SynapsesTable substituível em múltiplos contextos
- **ISP**: Props específicas, callbacks opcionais
- **DIP**: Queries abstraídas, componentes usam callbacks não implementações

---

## Métricas Atualizadas
- **Decisões documentadas:** 9 (adicionado #009)
- **Decisões rápidas:** 9 (3 novas sobre hierarquia)
- **Componentes criados:** 3 (BaseConhecimentoTable, Dialog, Container)
- **Componentes refatorados:** 4 (SynapsesTable, SynapseDialog, DeleteDialog, Actions)
- **API routes criadas:** 1 (/api/bases/[baseId]/synapses)
- **Queries criadas:** 9 (bases de conhecimento)
- **Server Actions criadas:** 4 (CRUD de bases)
- **Migrações SQL criadas:** 1 (hierarchy migration)
- **Build time:** 18.4s
- **Gaps do MVP resolvidos:** 1/4 (Gap #1: Hierarquia)

---

## Próximos Passos (Prioridade Alta)
1. **Executar migração SQL** `migrations/base-conhecimento-hierarchy.sql`
2. **Gap #2: Livechat Layout** - Ajustar para 4 colunas (conversations sidebar)
3. **Gap #3: Feedback de Mensagens** - Implementar like/dislike no livechat
4. **Gap #4: Quick Replies** - Respostas rápidas no livechat

## Próximos Passos (Prioridade Média)
- Refatorar SynapseDialog para reutilização no Neurocore
- Adicionar paginação se base tiver >50 synapses
- Adicionar busca/filtros em bases e synapses
- Melhorar empty states com call-to-action
