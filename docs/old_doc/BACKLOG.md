# Backlog - LIVIA MVP

Lista de tarefas técnicas pendentes e melhorias futuras.

---

## 🔴 Crítico (Segurança)

### [BACKLOG-016] Investigar e Corrigir RLS Policy de Agents

**Prioridade:** CRÍTICA (Antes de produção)
**Status:** 🔶 Workaround Aplicado (Solução Temporária)
**Criado em:** 2025-12-09

**Problema Identificado:**
- RLS policy existe e está configurada corretamente (`tenants_can_view_their_agents`)
- Policy usa `id_neurocore IN (SELECT neurocore_id ...)` com `auth.uid()`
- Mesmo com `auth.uid()` funcionando na aplicação, a RLS não filtra os agents
- Resultado: Todos os tenants veem agents de TODOS os neurocores (18 agents ao invés de 8)

**Evidências:**
```
User autenticado: b194c90c-e158-4c88-bdf0-5cbd6e35fba9
Email: admin@signumcursos.com
Agents esperados: 8 (do neurocore e266d1f8-1cc1-4db2-b0f5-4d14c9e5e2b4)
Agents retornados pela RLS: 18 (TODOS os neurocores)
```

**Hipótese Principal:**
- User pode ser `super_admin` (role que bypassa RLS intencionalmente)
- Ou: Sintaxe `IN (subquery)` não funciona bem com RLS em Next.js SSR
- Ou: Contexto de auth não está sendo passado corretamente para PostgreSQL

**Solução Temporária Aplicada:**
```typescript
// lib/queries/agents.ts
// Filtro manual adicionado até RLS funcionar
const agentsFiltered = agentsData.filter(agent =>
  agent.id_neurocore === tenantData.neurocore_id
);
```

**Arquivos Modificados:**
- ✅ `lib/queries/agents.ts` - Filtro manual + logs de debug
- ✅ `types/agents.ts` - Adicionado campo `id_neurocore`

**Scripts SQL de Diagnóstico Criados:**
- `check-agents-policies.sql` - Verificar policies existentes
- `check-policies-simples.sql` - Verificar sintaxe das policies
- `debug-agents-session.sql` - Diagnóstico completo com auth.uid()
- `test-rls-directly-fixed.sql` - Testar RLS no SQL Editor
- `verify-rls-policies.sql` - Validar configuração de RLS
- `fix-rls-with-exists.sql` - Solução proposta (usar EXISTS ao invés de IN)
- `fix-rls-force-rebuild.sql` - Reconstruir RLS do zero
- `check-my-role.sql` - Verificar se user é super_admin

**Próximos Passos (URGENTE):**

1. **Verificar Role do Usuário**
   - Executar `check-my-role.sql` para confirmar se é super_admin
   - Se for super_admin, a RLS está funcionando CORRETAMENTE
   - Nesse caso, ajustar filtro manual para permitir super_admin ver todos

2. **Se NÃO for super_admin:**
   - Aplicar `fix-rls-with-exists.sql` (usar EXISTS ao invés de IN)
   - Testar com usuário normal (não super_admin)
   - Se funcionar, remover filtro manual

3. **Ajustar Filtro Manual para Super Admin:**
   ```typescript
   // Buscar role do usuário
   const { data: userData } = await supabase
     .from('users')
     .select('role')
     .eq('id', user.id)
     .single();

   const isSuperAdmin = userData?.role === 'super_admin';

   // Super admin vê tudo, usuário normal vê apenas seu neurocore
   const agentsFiltered = isSuperAdmin
     ? agentsData
     : agentsData.filter(agent => agent.id_neurocore === tenantData.neurocore_id);
   ```

4. **Testes Necessários:**
   - ✅ Testar com super_admin (deve ver 18 agents)
   - ⏳ Testar com admin normal (deve ver 8 agents)
   - ⏳ Testar com attendant (deve ver 8 agents)

**Impacto de Segurança:**
- 🔴 **ALTO** - Vazamento de dados entre tenants
- ✅ **MITIGADO** - Filtro manual impede vazamento temporariamente
- ⚠️ **RISCO** - Se filtro manual for removido sem corrigir RLS

**Referências:**
- Policy atual: `tenants_can_view_their_agents` (usa IN + subquery)
- Policy super admin: `super_admins_full_access` (usa EXISTS + role check)
- Logs confirmam: auth.uid() funciona, mas RLS não filtra

---

### [BACKLOG-001] Corrigir Políticas RLS da Tabela Users

**Prioridade:** Alta (Antes de produção)
**Status:** ✅ Concluído
**Criado em:** 2025-11-17
**Concluído em:** 2025-11-17

**Problema resolvido:**
- ~~Tabela `users` tinha políticas RLS causando recursão infinita~~
- ~~Estava usando workaround com Service Role Key (bypassa RLS)~~

**Solução aplicada via MCP:**
1. ✅ Removidas todas as políticas problemáticas:
   - "Super_admin pode gerenciar todos os usuários" (causava recursão)
   - "User pode ver seus colegas de tenant" (causava recursão)

2. ✅ Criadas políticas seguras sem recursão:
   - "Users can read own data" - SELECT usando `auth.uid() = id`
   - "Users can update own data" - UPDATE usando `auth.uid() = id`

3. ✅ Workaround removido dos arquivos:
   - `app/actions/auth.ts` - Usando cliente normal
   - `app/livechat/page.tsx` - Usando cliente normal
   - `lib/queries/livechat.ts` - Todas as 5 funções usando cliente normal

**Migration aplicada:**
- `fix_users_rls_policies` - Executada via MCP Supabase

**Nota:** O arquivo `lib/supabase/admin.ts` foi mantido para casos futuros onde bypass de RLS seja necessário (ex: criação de usuários via backend).

---

## 🟡 Médio (Funcionalidades)

### [BACKLOG-002] Implementar Supabase Realtime

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-17

**Descrição:**
- Subscribe em conversas para atualização automática
- Subscribe em mensagens para chat em tempo real
- Atualizar UI automaticamente quando houver novas mensagens

**Arquivos Implementados:**
- ✅ `lib/hooks/use-realtime-conversation.ts` - Hook implementado
- ✅ `lib/hooks/use-realtime-messages.ts` - Hook implementado
- ✅ `components/livechat/conversation-view.tsx` - Integração com hooks

---

### [BACKLOG-003] Implementar Quick Replies

**Prioridade:** Baixa
**Status:** ✅ Concluído
**Concluído em:** 2025-11-26

**Descrição:**
- ✅ Interface completa para gerenciar templates de respostas rápidas
- ✅ CRUD completo (criar, editar, deletar)
- ✅ Incrementar contador de uso automaticamente
- ✅ Comando "/" para ativar quick replies no input
- ✅ Painel de busca e seleção de quick replies
- ✅ Quick replies mais utilizadas destacadas

**Arquivos Implementados:**
- ✅ `components/livechat/quick-reply-dialog.tsx`
- ✅ `components/livechat/quick-reply-item.tsx`
- ✅ `components/livechat/quick-replies-panel.tsx`
- ✅ `components/livechat/quick-replies-manager.tsx`
- ✅ `components/livechat/quick-reply-command.tsx`
- ✅ `app/api/quick-replies/route.ts`
- ✅ `app/api/quick-replies/[id]/route.ts`
- ✅ `app/api/quick-replies/usage/route.ts`
- ✅ `lib/queries/quick-replies.ts` (265 linhas)
- ✅ `migrations/005_alter_quick_reply_templates.sql`
- ✅ `migrations/seed-quick-replies-signum.sql`

---

### [BACKLOG-004] Implementar Base de Conhecimento

**Prioridade:** Alta
**Status:** ✅ Concluído
**Concluído em:** 2025-11-19

**Descrição:**
- ✅ Hierarquia Base de Conhecimento → Synapses
- ✅ CRUD completo de bases (criar, editar, deletar, ativar/desativar)
- ✅ CRUD completo de synapses (criar, editar, deletar, ativar/desativar)
- ✅ Layout master-detail (scroll horizontal de cards + tabela de synapses)
- ✅ Integração com 4 webhooks n8n para publicação/vetorização
- ✅ Modo mock configurável (N8N_MOCK=true)

**Webhooks N8N Integrados:**
- ✅ Sync Synapse (create/update) → gera embeddings
- ✅ Delete Synapse Embeddings → remove embeddings
- ✅ Toggle Synapse Embeddings → ativa/desativa embeddings
- ✅ Inactivate Base → inativa base (synapses inacessíveis)

**Arquivos Implementados:**
- ✅ `types/knowledge-base.ts` (6 tipos)
- ✅ `lib/queries/knowledge-base.ts` (9 queries)
- ✅ `app/actions/base-conhecimento.ts` (4 Server Actions)
- ✅ `app/actions/synapses.ts` (4 Server Actions com webhooks)
- ✅ `components/knowledge-base/knowledge-base-master-detail.tsx`
- ✅ `components/knowledge-base/base-conhecimento-carousel.tsx`
- ✅ `components/knowledge-base/base-conhecimento-card.tsx`
- ✅ `components/knowledge-base/base-conhecimento-form-dialog.tsx`
- ✅ `components/knowledge-base/synapses-table.tsx`
- ✅ `components/knowledge-base/synapse-dialog.tsx`
- ✅ `components/knowledge-base/synapse-actions.tsx`
- ✅ `components/knowledge-base/delete-synapse-dialog.tsx`
- ✅ `lib/utils/n8n-webhooks.ts`
- ✅ `app/api/bases/[baseId]/synapses/route.ts`
- ✅ `migrations/base-conhecimento-hierarchy.sql`

---

### [BACKLOG-005] Implementar Treinamento Neurocore

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-19

**Descrição:**
- ✅ Interface de chat para testar conhecimento da IA
- ✅ Envio de queries com validação (min 3, max 500 chars)
- ✅ Renderização de respostas em markdown (seguro)
- ✅ Visualização de synapses usadas com score de similaridade
- ✅ Progress bar visual para score (0-100%)
- ✅ Sistema de feedback (like/dislike com comentário opcional)
- ✅ Auto-scroll para última resposta
- ✅ Estado local das queries (não persiste no banco - simplicidade MVP)
- ✅ Modo mock configurável (NEUROCORE_MOCK=true)
- ✅ Timeout de 30s para n8n

**Arquivos Implementados:**
- ✅ `types/neurocore.ts` (TrainingQuery, TrainingResponse, etc.)
- ✅ `app/api/neurocore/query/route.ts` (API route com mock)
- ✅ `app/actions/neurocore.ts` (Server Action para feedback)
- ✅ `components/neurocore/neurocore-chat.tsx` (Container principal)
- ✅ `components/neurocore/training-query-input.tsx` (Form de pergunta)
- ✅ `components/neurocore/training-response-card.tsx` (Card de resposta)
- ✅ `components/neurocore/synapse-used-card.tsx` (Card de synapse)
- ✅ `components/neurocore/response-feedback-dialog.tsx` (Modal de feedback)

**Bibliotecas Adicionadas:**
- ✅ `react-markdown` + `remark-gfm` (renderizar markdown)
- ✅ `uuid` (IDs locais de queries)
- ✅ `sonner` (toast notifications)

---

### [BACKLOG-010] Message Feedback System

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-23

**Descrição:**
- ✅ Botões like/dislike em cada mensagem do livechat
- ✅ Comentário opcional com feedback negativo
- ✅ Armazenamento em tabela `message_feedbacks`
- ✅ Context JSON para rastreabilidade

**Arquivos Implementados:**
- ✅ `components/livechat/message-feedback-buttons.tsx`
- ✅ `app/api/feedback/message/route.ts`
- ✅ `lib/queries/feedback.ts`

---

### [BACKLOG-011] CRM Kanban Board

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-24

**Descrição:**
- ✅ Nova página `/crm` com board Kanban
- ✅ Organização de conversas por tags
- ✅ Colunas configuráveis (uma por tag)
- ✅ Gerenciamento de tags (criar, editar, ordenar, cores)
- ✅ Drag-and-drop preparatório
- ✅ Filtros de busca e status
- ✅ RLS policies para multi-tenant

**Arquivos Implementados:**
- ✅ `app/(dashboard)/crm/page.tsx`
- ✅ `components/crm/crm-kanban-board.tsx`
- ✅ `components/crm/crm-kanban-column.tsx`
- ✅ `components/crm/crm-conversation-card.tsx`
- ✅ `components/crm/crm-filters.tsx`
- ✅ `lib/queries/crm.ts`
- ✅ `types/crm.ts`
- ✅ `migrations/006_create_conversation_tags.sql`
- ✅ `migrations/007_alter_tags_add_order_color.sql`
- ✅ `migrations/008_add_tags_rls.sql`

---

### [BACKLOG-012] Conversation Summary Modal

**Prioridade:** Baixa
**Status:** ✅ Concluído
**Concluído em:** 2025-11-24

**Descrição:**
- ✅ Modal para exibir resumo da conversa
- ✅ Extração de dados do cliente
- ✅ Display de metadata extraída
- ✅ Memória e pendências abertas
- ✅ Funcionalidade de copiar dados

**Arquivos Implementados:**
- ✅ `components/livechat/conversation-summary-modal.tsx`
- ✅ `components/livechat/customer-data-panel.tsx`

---

### [BACKLOG-013] Profile Page + AI Global Pause Control

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-27

**Descrição:**
- ✅ Nova página `/perfil`
- ✅ Exibição de informações do usuário
- ✅ Exibição de informações do tenant
- ✅ Avatar do usuário
- ✅ **Controle Global de Pausa da IA**
  - Switch para pausar TODA a IA (system-wide)
  - Confirmação de segurança (digitar "PAUSAR")
  - Persiste no database
- ✅ Funcionalidade de logout

**Arquivos Implementados:**
- ✅ `app/(dashboard)/perfil/page.tsx`
- ✅ `components/profile/ai-control.tsx`

---

### [BACKLOG-014] Conversation Tags Management

**Prioridade:** Média
**Status:** ✅ Concluído
**Concluído em:** 2025-11-24

**Descrição:**
- ✅ Sistema completo de tags para conversas
- ✅ Associação many-to-many (conversa ↔ tags)
- ✅ CRUD de tags (nome, cor, ordem)
- ✅ Filtros por tag no livechat
- ✅ RLS policies para isolamento multi-tenant
- ✅ Tabela `conversation_tags` e `conversation_tag_associations`

**Arquivos Implementados:**
- ✅ `migrations/006_create_conversation_tags.sql`
- ✅ `migrations/007_alter_tags_add_order_color.sql`
- ✅ `migrations/008_add_tags_rls.sql`
- ✅ Integração em CRM Kanban Board

---

### [BACKLOG-015] Auto-Pause IA When Attendant Sends Message

**Prioridade:** Alta
**Status:** ✅ Concluído
**Concluído em:** 2025-11-23

**Descrição:**
- ✅ Quando atendente humano envia mensagem, IA pausa automaticamente
- ✅ Evita conflito entre respostas humanas e IA
- ✅ Integração com webhook n8n
- ✅ Atualiza campo `ia_active = false` no banco
- ✅ Feedback visual imediato no livechat

**Arquivos Implementados:**
- ✅ Lógica implementada em `components/livechat/message-input.tsx`
- ✅ Integração com `app/api/n8n/send-message/route.ts`

---

## 🟢 Baixo (Melhorias)

### [BACKLOG-006] Gerar Types Supabase Automaticamente

**Prioridade:** Baixa
**Status:** ✅ Parcialmente Concluído
**Concluído em:** 2025-11-17

**Descrição:**
- ✅ Types regenerados via MCP Supabase (`generate_typescript_types`)
- ✅ Arquivo `types/database.ts` atualizado (1132 linhas)
- ⏳ Pendente: Criar script NPM para facilitar regeneração
- ⏳ Pendente: Configurar CI/CD para atualizar types automaticamente

**Como regenerar manualmente:**
```bash
# Usar MCP do Supabase via curl
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://mcp.supabase.com/mcp?project_ref=$SUPABASE_PROJECT_REF" \
  -d '{"method":"tools/call","params":{"name":"generate_typescript_types"}}'
```

---

### [BACKLOG-007] Implementar Middleware de Autenticação

**Prioridade:** Baixa
**Status:** Não iniciado

**Descrição:**
- Criar `middleware.ts` para proteger rotas automaticamente
- Evitar verificação manual de auth em cada página

---

### [BACKLOG-008] Adicionar Testes

**Prioridade:** Baixa (Após MVP)
**Status:** Não iniciado

**Descrição:**
- Testes unitários para Server Actions
- Testes E2E para fluxo de autenticação
- Testes de integração com Supabase

---

### [BACKLOG-009] Otimizações de Performance (Banco de Dados)

**Prioridade:** Média (Antes de escala)
**Status:** Identificado
**Criado em:** 2025-11-17

**Avisos detectados via MCP Supabase Advisors:**

1. **Unindexed Foreign Keys (25 ocorrências)**
   - Problema: Foreign keys sem índice podem impactar performance em queries com JOINs
   - Tabelas afetadas: `base_conhecimentos`, `channels`, `contacts`, `conversations`, `messages`, `feedbacks`, `synapses`, `tenants`, `users`, etc.
   - Impacto: INFO (não crítico para MVP)
   - Solução: Criar índices nas colunas de foreign keys mais consultadas

2. **Auth RLS Initialization Plan (35+ ocorrências)**
   - Problema: Políticas RLS re-avaliam `auth.uid()` para cada linha
   - Solução: Substituir `auth.uid()` por `(select auth.uid())` nas políticas
   - Exemplo:
     ```sql
     -- Antes (lento)
     USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()))

     -- Depois (rápido)
     USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid())))
     ```

3. **Function Search Path Mutable**
   - Função: `update_updated_at_column`
   - Solução: Definir `search_path` na função

4. **Leaked Password Protection Disabled**
   - Proteção contra senhas vazadas desabilitada
   - Solução: Habilitar via Dashboard Supabase → Authentication → Password Settings

**Quando implementar:**
- Índices: Quando houver degradação de performance em produção
- RLS optimization: Quando escalar para 10k+ linhas por tabela
- Password protection: Implementar antes de produção

---

## 📝 Notas

- Itens marcados como **Crítico** devem ser resolvidos antes de deploy em produção
- Itens **Médio** e **Baixo** podem ser priorizados conforme necessidade
- Consultar DECISIONS.md antes de implementar mudanças arquiteturais
