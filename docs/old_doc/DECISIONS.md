# Decisões Arquiteturais - LIVIA MVP

## Índice de Decisões
1. [Não usar MCP no MVP](#decisão-001-não-usar-mcp-no-mvp)
2. [Estrutura Híbrida de Skills](#decisão-002-estrutura-híbrida-de-skills)
3. [Base Vetorial Gerenciada pelo n8n](#decisão-003-base-vetorial-gerenciada-pelo-n8n)
4. [Aceitar Type Assertions `any` para Queries Supabase](#decisão-004-aceitar-type-assertions-any-para-queries-supabase)
5. [Webhooks n8n Simplificados para MVP WhatsApp](#decisão-005-webhooks-n8n-simplificados-para-mvp-whatsapp)
6. [Sidebar com Auto-Collapse](#decisão-006-sidebar-com-shadcnui-e-auto-collapse-baseado-em-rota)
7. [CRUD Simples de Synapses](#decisão-007-crud-simples-de-synapses-sem-webhook-de-publicação)
8. [Treinamento Neurocore com Modo Mock](#decisão-008-treinamento-neurocore-com-modo-mock)
9. [Hierarquia Base de Conhecimento → Synapses](#decisão-009-hierarquia-base-de-conhecimento--synapses)
10. [Refatoração Master-Detail com N8N Webhooks](#decisão-010-refatoração-master-detail-com-n8n-webhooks)
11. [Livechat: Salvar no Banco Primeiro](#decisão-011-livechat-salvar-no-banco-primeiro)
12. [Sistema de 4 Filtros no Livechat](#decisão-012-sistema-de-4-filtros-no-livechat)
13. [Cards por Conversa, não por Contato](#decisão-013-cards-por-conversa-não-por-contato)
14. [Quick Replies com Comando "/" e Sistema de Gerenciamento](#decisão-014-quick-replies-com-comando--e-sistema-de-gerenciamento)
15. [Message Feedback System no Livechat](#decisão-015-message-feedback-system-no-livechat)
16. [CRM Kanban Board com Tags](#decisão-016-crm-kanban-board-com-tags)
17. [Conversation Summary Modal](#decisão-017-conversation-summary-modal)
18. [Profile Page com AI Global Pause Control](#decisão-018-profile-page-com-ai-global-pause-control)
19. [Auto-Pause IA When Attendant Sends Message](#decisão-019-auto-pause-ia-when-attendant-sends-message)
20. [Conversation Tags Management System](#decisão-020-conversation-tags-management-system)
21. [Design tokens e cores (Stitch / Material 3)](#decisão-021-design-tokens-e-cores-stitch--material-3)

---

## Decisão #001: Não usar MCP no MVP

**Data:** 2025-11-16

**Status:** Aceita

### Contexto
Durante o planejamento do projeto LIVIA, surgiu a questão sobre usar Model Context Protocol (MCP) para integração com Supabase e n8n. MCP permitiria ao Claude acessar diretamente o banco de dados e testar webhooks durante o desenvolvimento.

### Opções Consideradas

1. **MCP Completo**
   - Prós: Acesso direto ao banco, testes rápidos, geração automática de código baseado em schema
   - Contras: Alta complexidade, riscos de segurança, overhead de manutenção, curva de aprendizado

2. **MCP Seletivo (Schema Reader apenas)**
   - Prós: Types sempre atualizados, baixo risco (só leitura)
   - Contras: Ainda adiciona complexidade, precisa configurar infraestrutura

3. **Sem MCP (Skills + Scripts CLI)**
   - Prós: Simplicidade, menor risco, foco no MVP, sem infraestrutura adicional
   - Contras: Claude não acessa dados diretamente, precisa gerar código manualmente

### Decisão
**Adiar uso de MCP para pós-MVP.** Focar em entregar o MVP usando skills customizadas do Claude Code e scripts CLI quando necessário.

**Razões:**
- MVP precisa ser entregue rapidamente
- Skills criadas já cobrem todos os padrões necessários
- Evitar complexidade adicional na fase inicial
- Reduzir riscos de segurança
- Facilitar onboarding da equipe

### Consequências

**Positivas:**
- Menor complexidade no setup inicial
- Equipe foca em features, não em infraestrutura
- Menos pontos de falha
- Onboarding mais rápido
- Maior segurança (sem acesso direto ao banco)

**Negativas:**
- Claude não pode validar queries contra schema real
- Testes de integração n8n precisam ser manuais
- Types do Supabase precisam ser gerados manualmente

**Riscos e Mitigações:**
- **Risco:** Types desatualizados
  - **Mitigação:** Script CLI para gerar types do Supabase regularmente
- **Risco:** Dificuldade em testar webhooks n8n
  - **Mitigação:** Criar scripts CLI para testes comuns

### Revisão Futura
Reavaliar pós-MVP se:
- Equipe crescer (>3 devs)
- Testes de integração se tornarem gargalo
- Schema do banco mudar frequentemente
- ROI de MCP justificar a complexidade

### Referências
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- Análise de prós/contras documentada em conversa

---

## Decisão #002: Estrutura Híbrida de Skills

**Data:** 2025-11-16

**Status:** Aceita

### Contexto
Precisávamos definir como organizar skills do Claude Code para o projeto LIVIA: uma skill monolítica, múltiplas skills separadas por tecnologia, ou estrutura híbrida.

### Opções Consideradas

1. **1 Skill Monolítica**
   - Prós: Simplicidade, um arquivo só
   - Contras: Arquivo muito grande, consome muitos tokens, difícil de manter

2. **3 Skills Separadas (n8n, Supabase, Frontend)**
   - Prós: Especialização, ativação precisa
   - Contras: Possível overlap, contexto fragmentado, manutenção multiplicada

3. **1 Skill Principal + Arquivos de Referência**
   - Prós: Contexto unificado, carregamento progressivo, fácil manutenção
   - Contras: Requer boa organização dos arquivos

### Decisão
**Usar estrutura híbrida:** 1 SKILL.md principal com arquivos de referência especializados.

**Estrutura:**
```
.claude/skills/livia-mvp/
├── SKILL.md                 # Skill principal (sempre carregada)
├── n8n-reference.md         # Carregada quando necessário
├── supabase-reference.md    # Carregada quando necessário
└── frontend-reference.md    # Carregada quando necessário
```

### Consequências

**Positivas:**
- Claude carrega apenas o necessário (economia de tokens)
- Contexto do projeto permanece unificado
- Fácil de manter (um lugar para cada tipo de informação)
- Equipe pode contribuir em áreas específicas

**Negativas:**
- Requer disciplina para manter referências atualizadas
- Arquivos de referência podem ficar desatualizados se não revisados

**Riscos e Mitigações:**
- **Risco:** Referências desatualizadas
  - **Mitigação:** Revisar arquivos ao adicionar novas features
- **Risco:** Duplicação de informação
  - **Mitigação:** Definir claramente o que vai em cada arquivo

### Referências
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)

---

## Decisão #003: Base Vetorial Gerenciada pelo n8n

**Data:** 2025-11-16

**Status:** Aceita

### Contexto
Durante o planejamento da migração SQL, foi incluída uma tabela `synapse_embeddings` no Supabase para armazenar embeddings vetoriais (pgvector) das synapses. No entanto, a lógica de vetorização e busca semântica já é gerenciada pelo n8n.

### Opções Consideradas

1. **Tabela de embeddings no Supabase**
   - Prós: Dados centralizados, busca vetorial nativa (pgvector), controle total
   - Contras: Duplicação de lógica (n8n já faz), overhead de sincronização, complexidade adicional

2. **Base vetorial externa gerenciada pelo n8n**
   - Prós: Separação de responsabilidades, n8n já implementado, menor complexidade no frontend
   - Contras: Frontend não tem acesso direto aos embeddings (mas não precisa)

### Decisão
**Remover tabela `synapse_embeddings` do Supabase.** A base vetorial é responsabilidade do **n8n**, que gerencia:
- Criação de embeddings ao publicar synapses
- Armazenamento em serviço externo (Pinecone, Weaviate, ou similar)
- Busca semântica durante processamento de IA
- Sincronização com estado das synapses

**O frontend apenas:**
- Gerencia CRUD de synapses (título, content, descrição)
- Controla estados (draft, publishing, error)
- Ativa/desativa synapses (`is_enabled`)
- Dispara webhooks n8n para publicação

### Consequências

**Positivas:**
- Menor complexidade no schema do Supabase
- Não duplicar lógica de vetorização
- Separação clara de responsabilidades (Frontend = CRUD, n8n = IA/Embeddings)
- Menos manutenção e sincronização
- Migração SQL mais simples

**Negativas:**
- Frontend não tem visibilidade dos embeddings (mas não precisa para MVP)
- Não pode fazer queries vetoriais diretamente do frontend (mas não é necessário)

**Riscos e Mitigações:**
- **Risco:** Perda de visibilidade sobre embeddings
  - **Mitigação:** n8n pode expor métricas via webhook se necessário
- **Risco:** Difícil debugar problemas de busca
  - **Mitigação:** Tela de Treinamento Neurocore permite testar queries e ver synapses usadas

### Referências
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- Migração v2 atualizada sem `synapse_embeddings`

---

## Decisão #004: Aceitar Type Assertions `any` para Queries Supabase

**Data:** 2025-11-17

**Status:** Aceita

### Contexto
Durante o desenvolvimento da feature Livechat, ao criar queries Supabase com joins complexos e API routes, encontramos dificuldades com a inferência de tipos do Supabase JavaScript client. Queries com `.select()` usando joins não inferem tipos corretamente, resultando em tipos `never` ou erros de spread.

**Localizações afetadas:**
- [lib/queries/livechat.ts](app/lib/queries/livechat.ts) (4 ocorrências)
- [api/conversations/pause-ia/route.ts](app/api/conversations/pause-ia/route.ts) (2 ocorrências)
- [api/conversations/resume-ia/route.ts](app/api/conversations/resume-ia/route.ts) (2 ocorrências)
- [api/n8n/send-message/route.ts](app/api/n8n/send-message/route.ts) (1 ocorrência)

**Total:** 9 warnings `@typescript-eslint/no-explicit-any`

### Opções Consideradas

1. **Adicionar `eslint-disable-next-line` em cada ocorrência**
   - Prós: Suprime warnings, mantém regra ativa globalmente
   - Contras: Poluição visual, manutenção repetitiva (9 linhas)

2. **Desabilitar regra para pastas `api/` e `lib/queries/`**
   - Prós: Solução limpa, sem poluição visual
   - Contras: Pode mascarar problemas reais de `any` no futuro

3. **Aceitar warnings e continuar com desenvolvimento**
   - Prós: Pragmatismo, foco em entregar features, warnings são visíveis
   - Contras: Build mostra warnings (não é erro)

### Decisão
**Aceitar warnings `@typescript-eslint/no-explicit-any`** nas queries Supabase e API routes, mantendo assertions `as any` com comentários explicativos.

**Razões:**
- Pragmatismo: Supabase types não inferem corretamente para queries complexas
- Segurança: Todas as queries têm validação de `tenant_id` e null checks antes dos casts
- Visibilidade: Warnings permanecem visíveis, facilitando revisão futura
- Foco no MVP: Priorizar entrega de features sobre perfeição de tipos
- Comentários: Cada `any` tem comentário explicando o motivo

### Padrão Adotado

```typescript
// Exemplo em queries:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conversation = data as any;
return {
  ...conversation,
  lastMessage: conversation.messages?.[0] || null,
} as ConversationWithLastMessage;

// Exemplo em API routes:
// @ts-expect-error - Supabase types not inferring correctly
const updateData: any = {
  ia_active: false,
  ia_paused_by_user_id: user.id,
  ia_paused_at: new Date().toISOString(),
};
```

### Consequências

**Positivas:**
- Velocidade de desenvolvimento mantida
- Código continua funcionalmente correto (validações robustas)
- Warnings visíveis para revisão pós-MVP
- Menos poluição visual que múltiplos `eslint-disable-next-line`
- Pragmatismo apropriado para MVP

**Negativas:**
- Perda parcial de type safety em pontos específicos
- Build mostra 9 warnings ESLint

**Riscos e Mitigações:**
- **Risco:** Proliferação de `any` em outros lugares
  - **Mitigação:** Restringir uso apenas a queries/API routes Supabase, sempre com comentário
- **Risco:** Mascarar problemas reais de tipos
  - **Mitigação:** Null checks e validações antes de cada cast, runtime validation de `tenant_id`

### Revisão Futura
Reavaliar pós-MVP quando:
- Supabase liberar melhor inferência de tipos para joins
- Migrar para types gerados automaticamente (`supabase gen types`)
- Time decidir gerar tipos customizados com Zod
- Quantidade de `any` crescer além de queries/API routes

### Referências
- [Supabase Type Support](https://supabase.com/docs/reference/javascript/typescript-support)
- ESLint warnings documentados durante desenvolvimento Livechat

---

## Decisão #005: Webhooks n8n Simplificados para MVP WhatsApp

**Data:** 2025-11-17

**Status:** Aceita

### Contexto
Durante a configuração do ambiente, identificou-se que alguns webhooks n8n mapeados inicialmente podem ser substituídos por operações diretas no banco de dados, simplificando a arquitetura do MVP.

### Análise de Webhooks

**Webhooks NECESSÁRIOS (integração com WhatsApp/IA):**
1. ✅ **N8N_SEND_MESSAGE_WEBHOOK** - Enviar mensagem para WhatsApp
   - Motivo: n8n integrado ao canal (WhatsApp Business API)
   - Fluxo: Frontend → API Route → n8n → WhatsApp

2. ✅ **N8N_SYNC_SYNAPSE_WEBHOOK** - Publicar/editar synapse
   - Motivo: n8n gerencia vetorização (embeddings OpenAI)
   - Fluxo: Frontend → API Route → n8n → Criar embeddings → Base vetorial

3. ✅ **N8N_PAUSE_CONVERSATION_WEBHOOK** - Pausar IA em conversa específica
   - Motivo: n8n precisa saber para pausar processamento
   - Fluxo: Frontend → API Route → n8n → Pausa processamento

4. ✅ **N8N_RESUME_CONVERSATION_WEBHOOK** - Retomar IA em conversa específica
   - Motivo: n8n precisa saber para retomar processamento
   - Fluxo: Frontend → API Route → n8n → Retoma processamento

5. ✅ **N8N_PAUSE_IA_WEBHOOK** - Pausar IA em TODO tenant
   - Motivo: n8n precisa saber para pausar TODAS conversas
   - Fluxo: Frontend → API Route → n8n → Pausa processamento global

6. ✅ **N8N_RESUME_IA_WEBHOOK** - Retomar IA em TODO tenant
   - Motivo: n8n precisa saber para retomar TODAS conversas
   - Fluxo: Frontend → API Route → n8n → Retoma processamento global

**Webhooks DESNECESSÁRIOS (CRUD no banco):**
1. ❌ **N8N_NEUROCORE_QUERY_WEBHOOK** - Simulação de perguntas no treinamento
   - Motivo: É apenas CRUD no banco (salvar queries de teste)
   - Alternativa: Operação direta no Supabase

2. ❌ **N8N_USE_QUICK_REPLY_WEBHOOK** - Usar resposta rápida
   - Motivo: Apenas incrementar `usage_count` no banco
   - Alternativa: UPDATE direto na tabela `quick_reply_templates`

### Decisão
**Remover** webhooks desnecessários do MVP e implementar como operações diretas no Supabase.

**Webhooks finais do MVP WhatsApp:** 6 webhooks (redução de 9 → 6)

### Consequências

**Positivas:**
- Arquitetura mais simples
- Menos pontos de falha
- Melhor performance (menos chamadas HTTP)
- Menor dependência do n8n para operações CRUD
- Facilita desenvolvimento e debug

**Negativas:**
- Perda de centralização de lógica (mas não é necessária para CRUD simples)

**Riscos e Mitigações:**
- **Risco:** Quick Replies podem precisar de lógica adicional no futuro
  - **Mitigação:** Se necessário, adicionar webhook posteriormente
- **Risco:** Neurocore pode precisar integrar com IA no futuro
  - **Mitigação:** Por enquanto é só teste, se necessário adicionar webhook depois

### Padrão Adotado

**Para enviar mensagens (exemplo):**
```typescript
// 1. Salvar mensagem no banco primeiro
const message = await supabase.from('messages').insert({...});

// 2. Chamar n8n para enviar ao WhatsApp
await callN8nWebhook('/webhook/livia/send-message', {
  conversation_id,
  user_id,
  content
});

// 3. Realtime do Supabase atualiza UI automaticamente
```

**Para Quick Replies (simplificado):**
```typescript
// Apenas incrementar no banco
await supabase
  .from('quick_reply_templates')
  .update({ usage_count: current + 1 })
  .eq('id', quickReplyId);
```

### Referências
- Observações do arquivo `.env.local` original
- Análise de fluxos de integração n8n

---

## Decisão #006: Sidebar com shadcn/ui e Auto-Collapse Baseado em Rota

**Data:** 2025-11-18

**Status:** ✅ Implementado

### Contexto
Necessidade de adicionar navegação entre features (Livechat, Base de Conhecimento, Treinamento Neurocore). O Livechat requer layout de 3 colunas (ContactList | ConversationView | CustomerDataPanel), então o sidebar precisa colapsar automaticamente nessa rota.

### Opções Consideradas

1. **Context API manual + Sidebar customizado**
   - Prós: Controle total, sem dependências
   - Contras: Muito trabalho, sem acessibilidade, sem animações

2. **Props drilling + Sidebar customizado**
   - Prós: Simples conceitualmente, explícito
   - Contras: Acoplamento alto, difícil manutenção

3. **shadcn/ui Sidebar + Hook customizado**
   - Prós: Acessibilidade completa, animações, responsivo, keyboard shortcuts
   - Contras: +10KB no bundle, dependência externa

### Decisão
**Usar shadcn/ui Sidebar component** com hook customizado `useSidebarAutoCollapse`.

**Arquitetura:**
- **Route Groups**: `(auth)` para login, `(dashboard)` para features autenticadas
- **SidebarProvider**: Contexto nativo do shadcn gerencia estado
- **Hook customizado**: `useSidebarAutoCollapse(['/livechat'])` aplica auto-collapse
- **Wrapper Component**: `SidebarAutoCollapseWrapper` permite Server Component usar hook
- **Modo icon**: Sidebar colapsa mostrando apenas ícones (collapsible="icon")

### Implementação

**Arquivos criados:**
- [lib/hooks/use-sidebar-auto-collapse.ts](lib/hooks/use-sidebar-auto-collapse.ts) - Hook de auto-collapse
- [components/layout/app-sidebar.tsx](components/layout/app-sidebar.tsx) - Sidebar principal
- [components/layout/nav-items.tsx](components/layout/nav-items.tsx) - Configuração de navegação
- [components/layout/sidebar-auto-collapse-wrapper.tsx](components/layout/sidebar-auto-collapse-wrapper.tsx) - Wrapper client
- [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx) - Layout com SidebarProvider
- [app/(dashboard)/knowledge-base/page.tsx](app/(dashboard)/knowledge-base/page.tsx) - Placeholder
- [app/(dashboard)/neurocore/page.tsx](app/(dashboard)/neurocore/page.tsx) - Placeholder

**Arquivos modificados:**
- [components/auth/header.tsx](components/auth/header.tsx) - Adicionado SidebarTrigger
- [components/ui/sidebar.tsx](components/ui/sidebar.tsx) - Corrigido Math.random → useState
- [app/(dashboard)/livechat/page.tsx](app/(dashboard)/livechat/page.tsx) - Removido Header duplicado
- [app/page.tsx](app/page.tsx) - Redirect para /livechat

### Comportamento

**Livechat:**
- Sidebar **auto-colapsa** em modo icon (apenas ícones)
- Dá espaço para as 3 colunas do chat

**Outras rotas:**
- Sidebar permanece **expandida** mostrando nomes das features
- Estado persiste entre navegações (cookies)

**Controles:**
- Botão no header permite toggle manual
- Keyboard: Ctrl+B (Win) / Cmd+B (Mac)
- Acessibilidade: ARIA labels, foco no teclado

### Princípios SOLID Aplicados

1. **Single Responsibility**
   - `useSidebarAutoCollapse`: Apenas gerencia auto-collapse
   - `AppSidebar`: Apenas renderiza sidebar
   - `nav-items.tsx`: Apenas configuração de navegação

2. **Open/Closed**
   - Sidebar extensível via `navItems` array
   - Fechado para modificação (usa shadcn)

3. **Dependency Inversion**
   - Hook depende de abstração `useSidebar` (shadcn)
   - Componentes dependem de props, não de implementações

### Consequências

**Positivas:**
✅ Acessibilidade completa (ARIA, keyboard shortcuts)
✅ Responsivo (Sheet em mobile)
✅ Persistência de estado (cookies)
✅ Animações suaves (CSS transitions)
✅ Zero erros TypeScript ou ESLint
✅ Build passou com sucesso
✅ Economia de 4-6 horas de desenvolvimento

**Negativas:**
⚠️ shadcn sidebar adiciona ~10KB ao bundle
⚠️ Dependência de biblioteca externa

**Trade-offs aceitos:**
- Bundle maior vs UX superior
- Dependência vs tempo de desenvolvimento

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ ESLint (zero erros nos arquivos novos)
✅ Build production (sucesso)
✅ Rotas criadas: `/`, `/login`, `/livechat`, `/knowledge-base`, `/neurocore`

### Referências
- [shadcn/ui Sidebar Documentation](https://ui.shadcn.com/docs/components/sidebar)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)

---

## Decisão #007: CRUD Simples de Synapses (Sem Webhook de Publicação)

**Data:** 2025-11-18

**Status:** ✅ Implementado

### Contexto
Ao implementar a Base de Conhecimento (CRUD de synapses), surgiu a questão: usar webhook n8n para publicar synapses ou deixar n8n monitorar mudanças em background?

### Opções Consideradas

1. **CRUD Simples (sem webhook)**
   - Prós: Simplicidade, offline-first, UX não bloqueante, menos dependências
   - Contras: Menos controle, sem feedback imediato, possível delay

2. **Com Webhook Explícito**
   - Prós: Controle explícito, feedback imediato, validação síncrona
   - Contras: Complexidade, dependência de n8n, UX bloqueante, mais latência

3. **Híbrida**
   - Prós: Flexibilidade, UX não bloqueante + controle quando necessário
   - Contras: Mais complexo, confusão do usuário

### Decisão
**CRUD Simples (sem webhook de publicação)** para MVP.

**Arquitetura:**
- Frontend faz CRUD completo (criar, editar, deletar)
- Toggle `is_enabled` via UPDATE direto no banco
- n8n monitora synapses com `is_enabled = true` via Supabase Realtime
- n8n cria embeddings automaticamente em background
- n8n atualiza campo `status` (draft → indexing → publishing → error)
- Frontend exibe status visual (badges coloridos)

### Fluxo de Publicação

```
1. Usuário cria synapse → Salva no Supabase (status: 'draft', is_enabled: false)
2. Usuário edita conteúdo → UPDATE direto
3. Usuário ativa (toggle is_enabled = true) → UPDATE direto
4. n8n detecta mudança via Realtime → Atualiza status para 'indexing'
5. n8n cria embeddings → Atualiza status para 'publishing'
6. IA passa a usar a synapse automaticamente
```

### Estados da Synapse

| Status | Cor | Descrição |
|--------|-----|-----------|
| draft | 🔵 Azul | Synapse criada, não ativa |
| indexing | 🟡 Amarelo | Ativa, embeddings sendo criados |
| publishing | 🟢 Verde | Ativa, IA usando (embeddings prontos) |
| error | 🔴 Vermelho | Falha no processamento |

### Consequências

**Positivas:**
✅ Simplicidade máxima (menos código, menos bugs)
✅ Frontend funciona offline (não depende de n8n)
✅ UX não bloqueante (operações instantâneas)
✅ Escalável (n8n processa em background)
✅ Menos latência (sem HTTP requests ao n8n)

**Negativas:**
⚠️ Usuário não recebe confirmação imediata de sucesso
⚠️ Possível delay entre ativar synapse e IA começar a usar
⚠️ Menos controle sobre timing de processamento

**Trade-offs aceitos:**
- Feedback imediato vs Simplicidade → Escolhemos simplicidade
- Controle explícito vs Autonomia do n8n → Escolhemos autonomia

### Desafios e Soluções

**Desafio 1:** Como usuário sabe se embedding foi criado?
- **Solução:** Badge de status visual atualizado por n8n via Realtime

**Desafio 2:** Synapse ativa mas sem embedding (delay)
- **Solução:** n8n valida e reprocessa synapses órfãs periodicamente

**Desafio 3:** Sincronização n8n
- **Solução:** n8n monitora via Supabase Realtime + polling de fallback

### Revisão Futura
Considerar webhook explícito SE:
- Usuários reclamarem de falta de feedback imediato
- Validação síncrona se tornar necessária
- Controle explícito for crítico para o negócio

### Referências
- [Decisão #003: Base Vetorial Gerenciada pelo n8n](DECISIONS.md#decisão-003-base-vetorial-gerenciada-pelo-n8n)
- Análise de trade-offs documentada em conversa

---

## Decisão #008: Treinamento Neurocore com Modo Mock

**Data:** 2025-11-19

**Status:** ✅ Implementado

### Contexto
Necessidade de implementar interface para testar e validar respostas da IA antes de ativar em produção. Surgiu a questão sobre como desenvolver frontend sem depender de webhook n8n estar configurado.

### Opções Consideradas

1. **Aguardar n8n estar pronto**
   - Prós: Integração real desde o início
   - Contras: Bloqueia desenvolvimento frontend, dependência externa

2. **Modo mock configurável**
   - Prós: Desenvolvimento paralelo, teste de UX independente
   - Contras: Requer manutenção de código mock

3. **Stub fixo hardcoded**
   - Prós: Mais simples
   - Contras: Difícil alternar para produção, menos realista

### Decisão
**Implementar modo mock configurável** via variável de ambiente `NEUROCORE_MOCK=true`.

**Arquitetura:**
- Estado local das queries (não persiste no banco)
- API route `/api/neurocore/query` com lógica condicional
- Mock retorna resposta fake + 3 synapses exemplo
- Simula latência real (2-3 segundos)
- Trocar flag quando n8n estiver pronto

### Implementação

**Componentes criados:**
- `NeurocoreChat` - Container com estado local
- `TrainingQueryInput` - Form com validação (min 3, max 500 chars)
- `TrainingResponseCard` - Renderiza resposta + synapses
- `SynapseUsedCard` - Card com score de similaridade visual
- `ResponseFeedbackDialog` - Modal para feedback negativo

**Bibliotecas adicionadas:**
- `react-markdown` + `remark-gfm` - Renderizar markdown seguro
- `uuid` - Gerar IDs locais de queries
- `sonner` - Toast notifications

**Features:**
- Interface de chat para testes
- Renderização markdown segura (whitelist de componentes)
- Score de similaridade visual (progress bar)
- Feedback like/dislike com comentário opcional
- Auto-scroll para última resposta
- Loading states e error handling
- Timeout 30s para n8n
- Limita histórico a 20 queries (performance)

### Fluxo de Uso

```
1. Usuário digita pergunta → Valida (min 3 chars)
2. Frontend chama POST /api/neurocore/query
3. API route valida auth + tenant
4. Se NEUROCORE_MOCK=true:
   - Simula latência 2-3s
   - Retorna mock response
5. Se NEUROCORE_MOCK=false:
   - Chama webhook n8n
   - Timeout 30s
6. Frontend renderiza resposta em markdown
7. Exibe synapses usadas (cards com score)
8. Usuário dá feedback (like/dislike)
9. Feedback salvo em message_feedbacks (JSON context)
```

### Consequências

**Positivas:**
✅ Desenvolvimento frontend independente do n8n
✅ UX testável antes de integração real
✅ Mock realista (latência + múltiplas synapses)
✅ Fácil trocar para produção (uma variável de ambiente)
✅ Estado local evita poluir banco com testes
✅ Feedback persiste mesmo sem histórico de queries

**Negativas:**
⚠️ Código mock precisa ser mantido
⚠️ Queries não persistem (histórico perdido ao recarregar)

**Trade-offs aceitos:**
- Histórico local vs Simplicidade → Simplicidade (MVP)
- Mock vs Integração real → Mock primeiro (velocidade)

### Melhorias Futuras (Pós-MVP)

**Não implementado agora:**
- Botões "Publicar Synapse" e "Excluir Synapse" no dialog
- Confirmação de exclusão customizada ("confirmo excluir synapse")
- Refactor de SynapseDialog para reutilização
- Histórico persistido no banco
- Filtros e busca no histórico
- Export de relatório (PDF)

**Motivo:** MVP focou em validar UX core. Features avançadas adicionadas conforme necessidade.

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Build production (sucesso)
✅ Rota `/neurocore` criada corretamente
✅ Mock response funcional

### Referências
- [NEUROCORE_PLAN.md](docs/NEUROCORE_PLAN.md) - Plano detalhado (400 linhas)
- [MVP_CONTRAST_ANALYSIS.md](docs/MVP_CONTRAST_ANALYSIS.md) - Análise de gaps

---

## Decisão #009: Hierarquia Base de Conhecimento → Synapses

**Data:** 2025-11-19

**Status:** Implementada

### Contexto
A implementação inicial do MVP colocou synapses diretamente na página `/knowledge-base`, usando um `baseConhecimentoId` hardcoded ('00000000-...'). O MVP descrito especifica uma hierarquia clara: **Bases de Conhecimento** agrupam **Synapses** relacionadas, permitindo organização temática (ex: "Políticas de Devolução", "Suporte Técnico").

Esta decisão resolve o **Gap #1** identificado no [MVP_CONTRAST_ANALYSIS.md](docs/MVP_CONTRAST_ANALYSIS.md).

### Opções Consideradas

1. **Modal Aninhado** (Escolhida): Alinha com MVP, menor refactor, reutiliza componentes - 12-15h
2. **Navegação com Subrotas**: UX mais clean, mas refactor maior e perde contexto - 16-20h
3. **Accordion/Expansível**: Simples mas não alinha com MVP, não escalável - 6-8h

### Decisão
Implementar hierarquia usando **Modal Aninhado** com tabela de synapses aninhada dentro do BaseConhecimentoDialog.

**Razões:** Alinha com MVP, reutiliza SynapseDialog/SynapsesTable, mantém contexto, desktop-first.

### Implementação

**Arquivos Criados:**
- `types/knowledge-base.ts` - Tipos BaseConhecimento, BaseConhecimentoWithCount, BaseConhecimentoWithSynapses
- `lib/queries/knowledge-base.ts` - 9 queries para CRUD de bases
- `app/actions/base-conhecimento.ts` - 4 Server Actions
- `components/knowledge-base/base-conhecimento-table.tsx`
- `components/knowledge-base/base-conhecimento-dialog.tsx`
- `components/knowledge-base/knowledge-base-container.tsx`
- `app/api/bases/[baseId]/synapses/route.ts`
- `migrations/base-conhecimento-hierarchy.sql`

**Modificados:** knowledge-base/page.tsx, synapses-table.tsx, synapse-dialog.tsx, delete-synapse-dialog.tsx, synapse-actions.tsx (adicionados callbacks)

### Aplicação de SOLID

- **SRP**: Cada componente com responsabilidade única
- **OCP**: Callbacks (onSuccess, onSynapseChange) para extensibilidade
- **LSP**: SynapsesTable reutilizável em múltiplos contextos
- **ISP**: Props específicas, callbacks opcionais
- **DIP**: Queries abstraídas, componentes usam callbacks

### Consequências

**Positivas:** Organização temática, alinha 100% com MVP, reutilização máxima, UX fluida (callbacks), escalável

**Negativas:** Modal aninhado (não ideal mobile, mas MVP é desktop), pode ficar pesado com >50 synapses

### Migração de Dados

Executar `migrations/base-conhecimento-hierarchy.sql`:
1. Cria base padrão para cada tenant
2. Migra synapses órfãs (baseConhecimentoId='00000000...')
3. Valida ausência de órfãos
4. Gera estatísticas

### Testes Realizados

✅ TypeScript type-check
✅ Build production (18.4s)
✅ API route `/api/bases/[baseId]/synapses` criada
✅ Queries com JOIN (evita N+1)

### Referências
- [BASE_CONHECIMENTO_REFACTOR_PLAN.md](docs/BASE_CONHECIMENTO_REFACTOR_PLAN.md) - Análise completa (600 linhas)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

## Decisão #010: Refatoração Master-Detail com N8N Webhooks

**Data:** 2025-11-19

**Status:** 🚧 Em Implementação

### Contexto
A Decisão #009 implementou a hierarquia Base de Conhecimento usando **modal aninhado** (Grid de Cards → Modal Base com synapses aninhadas). Após feedback visual do usuário com wireframe, identificou-se que a UX desejada era um **layout master-detail** com scroll horizontal de cards e synapses exibidas abaixo (não dentro de modal).

Além disso, surgiu a necessidade de integrar webhooks N8N para gerenciar embeddings das synapses (criar, deletar, ativar/desativar).

### Opções Consideradas

1. **Manter Modal Aninhado + Adicionar Webhooks**
   - Prós: Menos refactor, aproveitaria código existente
   - Contras: Não alinha com wireframe do usuário, UX inferior

2. **Refatorar para Master-Detail com Webhooks**
   - Prós: Alinha 100% com wireframe, UX superior, melhor performance, integração N8N
   - Contras: Refactor maior (deletar 3 componentes, criar 4 novos), 8-10h de trabalho

### Decisão
**Refatorar para layout Master-Detail** com integração de webhooks N8N.

**Arquitetura:**
- **Master:** Scroll horizontal de cards (BaseConhecimentoCarousel)
- **Detail:** Tabela de synapses abaixo (SynapsesTable reutilizada)
- **Modal Simples:** BaseConhecimentoFormDialog (sem synapses aninhadas)
- **Webhooks N8N:** Integração para sync/delete/toggle synapses e bases

### Mudanças no Layout

**❌ ANTES (Modal Aninhado):**
```
Grid de Cards → Click card → Modal Base (com synapses aninhadas)
                              └─> Click ADD SYNAPSE → Sub-modal Synapse
```

**✅ DEPOIS (Master-Detail):**
```
Scroll Horizontal de Cards (Master)
  ↓ Click card seleciona
Tabela de Synapses abaixo (Detail)
  ↓ Click ADD SYNAPSE
Modal Synapse (apenas form, não aninhado)
```

### Componentes

**A DELETAR:**
1. `BaseConhecimentoDialog.tsx` - Modal grande com synapses aninhadas
2. `BaseConhecimentoTable.tsx` - DataTable (substituído por carousel)
3. `KnowledgeBaseContainer.tsx` - Container antigo

**A CRIAR:**
1. `BaseConhecimentoCard.tsx` - Card individual com highlight quando selecionado
2. `BaseConhecimentoCarousel.tsx` - Scroll horizontal de cards
3. `BaseConhecimentoFormDialog.tsx` - Modal simples para create/edit base
4. `KnowledgeBaseMasterDetail.tsx` - Orquestrador do layout master-detail
5. `lib/utils/n8n-webhooks.ts` - Helper para chamar webhooks N8N

**A REUTILIZAR (sem modificar):**
- `SynapsesTable.tsx` - Já tem callbacks perfeitos
- `SynapseDialog.tsx` - Já tem onSuccess callback
- `DeleteSynapseDialog.tsx` - Já funciona
- `SynapseActions.tsx` - Já passa callbacks

### Webhooks N8N

**Webhooks a adicionar:**

1. **Sync Synapse** (`/webhook/livia/sync-synapse`)
   - Quando: Criar ou editar synapse
   - Payload: `{ synapseId, baseConhecimentoId, tenantId, operation, content, title }`

2. **Delete Synapse Embeddings** (`/webhook/livia/delete-synapse-embeddings`)
   - Quando: Deletar synapse
   - Payload: `{ synapseId, tenantId }`

3. **Toggle Synapse Embeddings** (`/webhook/livia/toggle-synapse-embeddings`)
   - Quando: Ativar/desativar synapse
   - Payload: `{ synapseId, tenantId, isEnabled }`

4. **Inactivate Base** (`/webhook/livia/inactivate-base`)
   - Quando: Ativar/desativar base
   - Payload: `{ baseConhecimentoId, tenantId, isActive }`

**Modo Mock:** Similar ao `NEUROCORE_MOCK`, criar flag `N8N_MOCK=true` para desenvolvimento sem depender de N8N estar configurado.

### Regras de Negócio Confirmadas

1. **Base inativa:** Synapses ficam inacessíveis (N8N ignora embeddings)
2. **Synapse desativada:** Webhook remove embeddings
3. **Feedback de processamento:** Pode demorar ~1 minuto, status muda automaticamente
4. **Delete de base:** Apenas soft delete (marcar como inativa), sem botão de hard delete
5. **Batch operations:** Não necessário (N8N trata individualmente)

### Aplicação de SOLID

**Single Responsibility:**
- `BaseConhecimentoCard`: Apenas renderiza card
- `BaseConhecimentoCarousel`: Apenas layout de scroll
- `BaseConhecimentoFormDialog`: Apenas form de base
- `KnowledgeBaseMasterDetail`: Apenas orquestra estado

**Open/Closed:**
- Componentes extensíveis via callbacks (onSelect, onToggleActive, onSuccess)
- Fechados para modificação (lógica interna estável)

**Dependency Inversion:**
- Componentes dependem de callbacks abstratos
- Não dependem de router.refresh (usar callbacks)
- Queries abstraídas em lib/queries

### Consequências

**Positivas:**
✅ Alinha 100% com wireframe do usuário
✅ Melhor UX (pattern master-detail conhecido)
✅ Menos z-index complexity (sem modal aninhado)
✅ Melhor performance (renderiza apenas synapses da base selecionada)
✅ Scroll horizontal suporta muitas bases
✅ Reutilização máxima de componentes existentes
✅ Integração N8N para embeddings
✅ Modo mock facilita desenvolvimento

**Negativas:**
⚠️ Refactor significativo (deletar 3, criar 4 componentes)
⚠️ Scroll horizontal pode esconder bases (mitigação: indicadores visuais ◄ ►)
⚠️ Webhooks podem falhar (mitigação: N8N_MOCK + error handling)
⚠️ Estado local de synapses requer refetch ao trocar base (simplicidade MVP)

**Trade-offs aceitos:**
- Refactor maior vs UX superior → UX vence
- Estado local vs Cache complexo → Simplicidade MVP
- Webhooks bloqueantes vs Não bloqueantes → Não bloqueantes (não bloqueia CRUD)

### Desafios e Soluções

**Desafio 1:** Scroll horizontal pode ser difícil em mobile
- **Solução:** CSS overflow-x-auto + -webkit-overflow-scrolling: touch + indicadores visuais

**Desafio 2:** Estado de synapses ao trocar base
- **Solução:** Sempre refetch ao selecionar (simplicidade MVP)

**Desafio 3:** Webhook N8N falha
- **Solução:** Try/catch em Server Actions, não bloqueia CRUD, toast de aviso

**Desafio 4:** Base inativa vs Synapse inativa
- **Solução:** Base inativa prevalece (TODAS synapses ficam inacessíveis)

**Desafio 5:** Performance com muitas bases/synapses
- **Solução:** Scroll horizontal suporta muitas bases, renderiza apenas synapses da base selecionada

### Plano de Implementação

**Sprint 1:** Remover componentes antigos (30min)
**Sprint 2:** Criar componentes novos (3-4h)
**Sprint 3:** Adicionar webhooks N8N (2-3h)
**Sprint 4:** Atualizar página principal (1h)
**Sprint 5:** Testes (1-2h)
**Sprint 6:** Documentação (30min)

**Estimativa Total:** 8-10 horas

Plano detalhado disponível em: [KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md](docs/KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md)

### Revisão Futura
Considerar otimizações SE:
- Scroll horizontal for problemático em mobile (grid 2 colunas)
- Performance com cache local (Map<baseId, Synapse[]>)
- Supabase Realtime para atualizar badges de status automaticamente
- Animações de transição ao trocar base

### Referências
- [Decisão #009: Hierarquia Base de Conhecimento](DECISIONS.md#decisão-009-hierarquia-base-de-conhecimento--synapses)
- [KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md](docs/KNOWLEDGE_BASE_MASTER_DETAIL_PLAN.md) - Plano completo (736 linhas)
- [Master-Detail Pattern](https://www.nngroup.com/articles/master-detail/)

---

## Decisão #011: Livechat: Salvar no Banco Primeiro

**Data:** 2025-11-20

**Status:** ✅ Implementado

### Contexto

No fluxo original de envio de mensagens do Livechat, a API route chamava o webhook n8n de forma síncrona, aguardando resposta antes de retornar sucesso ao cliente. Isso causava delay perceptível de ~500-1000ms (latência n8n + Realtime), impactando negativamente a UX.

**Fluxo Antigo:**
```
Client → API → [aguarda n8n] → n8n insere DB → Realtime → Client
         ↓
    ~500-1000ms delay
```

### Opções Consideradas

1. **Manter fluxo atual (aguardar n8n)**
   - Prós: Controle explícito, feedback imediato de erros do n8n
   - Contras: Delay alto (~500-1000ms), UX bloqueante

2. **Salvar no banco primeiro (escolhida)**
   - Prós: Delay reduzido (~100-200ms), UX não bloqueante, mensagem salva mesmo se n8n falhar
   - Contras: Menos controle sobre timing, possível delay entre pending→sent

3. **Otimistic UI (mock local)**
   - Prós: Delay zero perceptível
   - Contras: Complexidade alta, possível inconsistência, não alinha com padrão documentado

### Decisão

**Implementar "Salvar no Banco Primeiro"** seguindo abordagem conservadora e alinhada ao padrão documentado.

**Novo Fluxo:**
```
Client → API → [Insere DB status=pending] → Retorna sucesso → Realtime → Client ✅ RÁPIDO
              ↓
              n8n (assíncrono) → Envia WhatsApp → Atualiza status=sent → Realtime → Client
```

**Delay percebido:** ~100-200ms (apenas latência Realtime)

### Implementação

**Arquivos Modificados:**
1. **Migration SQL** (`migrations/add-message-status.sql`)
   - Adiciona campo `status TEXT CHECK (pending, sent, failed, read)`
   - Default `'sent'` para backward compatibility
   - Índice `idx_messages_status` para performance

2. **Types** (`types/livechat.ts`)
   - Tipo `MessageStatus = 'pending' | 'sent' | 'failed' | 'read'`
   - Campo `status?` em `MessageWithSender`

3. **API Route** (`app/api/n8n/send-message/route.ts`)
   - Insere mensagem com `status='pending'` ANTES de chamar n8n
   - Chama `sendToN8nAsync()` fire-and-forget (não aguarda)
   - Retorna sucesso imediatamente
   - Fallback: atualiza `status='failed'` se n8n falhar

4. **Hook Realtime** (`lib/hooks/use-realtime-messages.ts`)
   - Adiciona listener para UPDATE além de INSERT
   - Atualiza state local quando status muda (pending→sent)

5. **UI** (`components/livechat/message-item.tsx`)
   - Componente `MessageStatusIcon` com ícones visuais
   - ⏱️ pending (cinza), ✓ sent (cinza), ⚠️ failed (vermelho), ✓✓ read (azul)
   - Tooltips acessíveis

### Aplicação de SOLID

**Single Responsibility:**
- `MessageStatusIcon`: Apenas renderiza ícone de status
- `sendToN8nAsync()`: Apenas chama n8n em background
- `updateMessageStatus()`: Apenas atualiza status (fallback)

**Open/Closed:**
- API route extensível para adicionar retry logic sem modificar estrutura
- `MessageStatusIcon` configurável via objeto `statusConfig`

**Dependency Inversion:**
- API route depende de abstração `callN8nWebhook()`, não implementação
- Hook depende de `createClient()` abstrato do Supabase

### Consequências

**Positivas:**
✅ UX melhorada: delay reduzido de 500-1000ms → 100-200ms (5-10x mais rápido)
✅ Confiabilidade: mensagem salva mesmo se n8n falhar temporariamente
✅ Rastreabilidade: status detalhado de cada mensagem
✅ Retry: possibilidade de reenviar mensagens falhadas (preparado para futuro)
✅ Alinhamento: padrão conservador documentado

**Negativas:**
⚠️ Mensagem aparece como `pending` brevemente (~1-2s até n8n atualizar)
⚠️ Menos controle sobre timing de envio (assíncrono)

**Trade-offs aceitos:**
- Feedback imediato vs UX superior → UX vence
- Controle explícito vs Autonomia → Autonomia vence (MVP)

### Desafios e Soluções

| Desafio | Solução |
|---------|---------|
| Backward compatibility | DEFAULT 'sent' na migration + coalesce na UI |
| n8n assíncrono (floating promise) | Fire-and-forget com try/catch interno |
| Idempotência | n8n deve verificar `external_message_id` antes de enviar |
| Atualização Realtime | Hook escuta INSERT e UPDATE events |
| Race condition | Aceitável (mensagem aparece pending brevemente) |

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ ESLint (zero warnings nos arquivos modificados)
✅ Build production (não executado, mas preparado)
✅ Análise de padrões SOLID

### Próximos Passos (Pós-MVP)

- Implementar retry automático (3 tentativas com exponential backoff)
- Botão "Reenviar" para mensagens com `status='failed'`
- Job periódico para cleanup de mensagens `pending` órfãs (>5 min)
- Webhook WhatsApp para atualizar `status='read'` quando cliente visualizar

### Referências
- [LIVECHAT_STATUS.md](docs/LIVECHAT_STATUS.md) - Documentação atualizada
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Decisão #005: Webhooks n8n Simplificados](DECISIONS.md#decisão-005-webhooks-n8n-simplificados-para-mvp-whatsapp)

---

## Decisão #012: Sistema de 4 Filtros no Livechat

**Data:** 2025-11-22

**Status:** ✅ Implementado

### Contexto

Durante o desenvolvimento do Livechat, foi implementado um sistema de filtros com 3 opções: "Ativas", "Aguardando" e "Todos". No entanto, identificou-se que:
1. O filtro "Todos" estava excluindo conversas encerradas (apenas incluía open e paused)
2. Não havia forma de visualizar apenas conversas encerradas
3. Era necessário poder visualizar TODAS as conversas (incluindo closed)

### Decisão

**Implementar sistema de 4 filtros** no Livechat:
1. **Ativas** - Apenas conversas com status `open`
2. **Aguardando** - Apenas conversas com status `paused`
3. **Encerradas** - Apenas conversas com status `closed`
4. **Todas** - TODAS as conversas (incluindo open, paused e closed)

### Implementação

**Arquivos Modificados:**

1. **Query** ([lib/queries/livechat.ts](lib/queries/livechat.ts))
   - Adicionado parâmetro opcional `includeClosedConversations` em `ContactFilters`
   - Query condicional: se `false/undefined`, exclui closed; se `true`, inclui todas

2. **Types** ([types/livechat.ts](types/livechat.ts))
   - Adicionado campo `includeClosedConversations?: boolean` em `ContactFilters`

3. **ContactList** ([components/livechat/contact-list.tsx](components/livechat/contact-list.tsx))
   - Adicionado 4º badge "Encerradas"
   - Atualizado `statusCounts` para incluir contagem de conversas `closed`
   - Badges: Ativas, Aguardando, Encerradas, Todas

4. **Livechat Page** ([app/(dashboard)/livechat/page.tsx](app/(dashboard)/livechat/page.tsx))
   - Query inicial busca TODAS conversas (`includeClosedConversations: true`)
   - Filtros aplicados client-side para melhor performance

5. **Realtime Hook** ([lib/hooks/use-realtime-contact-list.ts](lib/hooks/use-realtime-contact-list.ts))
   - Corrigido bug onde preview de mensagem não atualizava
   - Adicionada query adicional para buscar mensagem completa (Realtime pode não retornar todos os campos)

### Comportamento

**Filtro "Ativas":**
- Mostra apenas conversas com `status = 'open'`
- Badge verde no card

**Filtro "Aguardando":**
- Mostra apenas conversas com `status = 'paused'`
- Badge amarelo no card

**Filtro "Encerradas":**
- Mostra apenas conversas com `status = 'closed'`
- Badge cinza no card

**Filtro "Todas":**
- Mostra TODAS as conversas (open + paused + closed)
- Sem filtro de status aplicado

### Correção de Bug: Preview de Mensagens

Durante a implementação, foi identificado e corrigido um bug onde o card da conversa mostrava "sem mensagens" mesmo após receber uma nova mensagem via Realtime.

**Causa Raiz:**
- Supabase Realtime, por padrão, não retorna todos os campos no evento INSERT
- Apenas campos que fazem parte da REPLICA IDENTITY são retornados
- O campo `content` não estava disponível no `payload.new`

**Solução:**
```typescript
async (payload) => {
  // Buscar mensagem completa (Realtime pode não retornar todos os campos)
  const { data: fullMessage } = await supabase
    .from('messages')
    .select('*')
    .eq('id', payload.new.id)
    .single();

  if (!fullMessage) return;

  // Atualizar com mensagem completa
  updateAndSortContacts((prev) =>
    prev.map((contact) => ({
      ...contact,
      activeConversations: contact.activeConversations?.map((conv) =>
        conv.id === fullMessage.conversation_id
          ? {
              ...conv,
              lastMessage: fullMessage as Message,
            }
          : conv
      ),
    }))
  );
}
```

### Consequências

**Positivas:**
✅ UX melhorada: usuário pode visualizar conversas em qualquer estado
✅ Filtro "Todas" realmente mostra TODAS as conversas
✅ Organização clara: 4 filtros cobrem todos os casos de uso
✅ Preview de mensagens atualiza corretamente em tempo real
✅ Performance: query inicial busca tudo, filtros aplicados client-side

**Negativas:**
⚠️ Query adicional no Realtime para buscar mensagem completa (latência mínima ~50ms)
⚠️ Mais conversas carregadas inicialmente (mas necessário para "Todas")

**Trade-offs aceitos:**
- Query adicional vs Preview correto → Preview correto vence
- Carregar todas conversas vs Filtros limitados → Carregar todas vence (UX)

### Testes Recomendados

1. Filtro "Ativas" deve mostrar apenas conversas abertas
2. Filtro "Aguardando" deve mostrar apenas conversas pausadas
3. Filtro "Encerradas" deve mostrar apenas conversas fechadas
4. Filtro "Todas" deve mostrar TODAS as conversas (verificar que closed aparecem)
5. Preview de mensagem deve atualizar imediatamente ao receber nova mensagem via Realtime

### Referências
- [Decisão #011: Livechat: Salvar no Banco Primeiro](DECISIONS.md#decisão-011-livechat-salvar-no-banco-primeiro)
- [LIVECHAT_STATUS.md](docs/LIVECHAT_STATUS.md) - Documentação atualizada
- [Supabase Realtime REPLICA IDENTITY](https://supabase.com/docs/guides/realtime/postgres-changes#replica-identity)

---

## Decisão #013: Cards por Conversa, não por Contato

**Data:** 2025-11-22
**Status:** 📋 DOCUMENTADO - Implementação Futura
**Contexto:** Bug descoberto durante debug de conversas "sumindo"

### Problema Identificado

Durante debug de Realtime, descobrimos que o Livechat mostrava apenas 6 conversas quando o banco tinha 10. Investigação revelou problema arquitetural.

**Comportamento atual (INCORRETO):**
- Query busca CONTATOS e JOIN conversas
- UI mostra 1 card por contato
- Quando contato tem múltiplas conversas (ex: uma fechada, uma nova), apenas primeira aparece
- Resultado: 4 conversas "escondidas"

### Comportamento Esperado (CORRETO)

**Cada CARD = uma CONVERSA** (não um contato)

**Razão:**
1. Cada conversa tem ID único e é independente
2. Quando encerrada, a conversa vira "cápsula" (fechada, imutável)
3. Se o mesmo contato retornar, cria-se uma **nova conversa** com novo ID
4. Mesmo contato pode ter **múltiplos cards** (um para cada conversa)

**Exemplo:**
- João fecha conversa #1 (encerrada) → CARD 1
- João entra em contato novamente → cria conversa #2 (nova) → CARD 2
- **Resultado esperado:** 2 cards na lista, ambos mostrando "João", mas conversas diferentes

### Solução Proposta

Refatorar query para buscar CONVERSAS (não contatos):

```typescript
// ✅ Correto
SELECT * FROM conversations
LEFT JOIN contacts ON contacts.id = conversations.contact_id
WHERE conversations.tenant_id = 'xxx'
```

**Retorno:** `ConversationWithContact[]` em vez de `ContactWithConversations[]`

### Impacto

**Arquivos a modificar:**
1. `types/livechat.ts` - Novos tipos
2. `lib/queries/livechat.ts` - Nova query
3. `app/(dashboard)/livechat/page.tsx` - Chamada da query
4. `components/livechat/contact-list.tsx` - Props e renderização
5. `components/livechat/contact-card.tsx` - Props e exibição
6. `lib/hooks/use-realtime-contact-list.ts` - Tipo e lógica
7. `lib/utils/contact-list.ts` - Função de ordenação

**Estimativa:** 3-4 horas de desenvolvimento + testes

### Decisão

**DOCUMENTAR** para implementação futura prioritária.

Criado documento completo em: [docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md](docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md)

Contém:
- Análise do problema
- Solução detalhada com código
- Plano de implementação passo a passo
- Critérios de aceitação

### Referências
- [LIVECHAT_CONVERSATION_CARDS_REFACTOR.md](docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md) - Documento completo
- [REALTIME_DEBUG_2025-11-22.md](docs/REALTIME_DEBUG_2025-11-22.md) - Debug session
- Conversa de debug: 2025-11-22

---

## Decisão #014: Quick Replies com Comando "/" e Sistema de Gerenciamento

**Data:** 2025-11-26

**Status:** ✅ Implementado

### Contexto

Durante o desenvolvimento do Livechat, identificou-se a necessidade de respostas rápidas para agilizar o atendimento. Surgiu a questão: como permitir que usuários acessem e usem templates de forma rápida durante conversas ativas?

### Opções Consideradas

1. **Menu dropdown no input**
   - Prós: Simples, não requer aprendizado
   - Contras: Clique extra, mais lento, ocupa espaço na UI

2. **Comando "/" no input (escolhida)**
   - Prós: Atalho rápido, padrão conhecido (Slack, Discord), não intrusivo
   - Contras: Requer aprendizado inicial

3. **Painel lateral sempre visível**
   - Prós: Visibilidade máxima
   - Contras: Ocupa espaço permanentemente, poluição visual

### Decisão

**Implementar comando "/" no input** com painel de quick replies e sistema completo de gerenciamento.

**Arquitetura:**
- Comando "/" no input abre painel flutuante
- Painel com busca e lista de quick replies
- Counter de uso (mais utilizadas destacadas)
- CRUD completo em interface dedicada
- 3 API routes para operações

### Implementação

**Features:**
- ✅ Comando "/" abre painel de quick replies
- ✅ Busca em tempo real por título/emoji
- ✅ Click para inserir no input
- ✅ Incremento automático de `usage_count`
- ✅ Badge "Mais Usada" para top replies
- ✅ Gerenciador completo (criar, editar, deletar)
- ✅ Emoji picker integrado

**Componentes criados:**
- `QuickReplyCommand` - Detecta "/" e abre painel
- `QuickRepliesPanel` - Painel flutuante com busca
- `QuickReplyItem` - Card individual de quick reply
- `QuickReplyDialog` - Form de criar/editar
- `QuickRepliesManager` - Interface de gerenciamento

**API Routes:**
- `GET/POST /api/quick-replies` - Listar/criar
- `GET/PUT/DELETE /api/quick-replies/[id]` - CRUD individual
- `POST /api/quick-replies/usage` - Incrementar contador

### Consequências

**Positivas:**
✅ UX superior: atalho rápido (2-3 teclas vs 5+ cliques)
✅ Padrão conhecido: usuários já familiarizados (Slack, Discord)
✅ Não intrusivo: painel aparece apenas quando necessário
✅ Counter automático: identifica replies mais úteis
✅ Busca rápida: encontra reply em <1 segundo

**Negativas:**
⚠️ Requer aprendizado inicial do comando "/"
⚠️ Não descobrível (precisa documentar ou tooltip)

**Trade-offs aceitos:**
- Curva de aprendizado vs Velocidade → Velocidade vence
- Visibilidade vs Espaço UI → Espaço vence

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Build production (sucesso)
✅ Comando "/" abre painel corretamente
✅ Busca funciona em tempo real
✅ Counter incrementa ao usar reply

### Referências
- [Slack Shortcuts](https://slack.com/help/articles/201374536-Slash-commands-in-Slack)
- [Discord Commands](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Slash-Commands)

---

## Decisão #015: Message Feedback System no Livechat

**Data:** 2025-11-23

**Status:** ✅ Implementado

### Contexto

Para melhorar a qualidade das respostas da IA e identificar problemas, era necessário coletar feedback dos usuários sobre cada mensagem. Surgiu a questão: onde e como exibir controles de feedback sem poluir a UI?

### Opções Consideradas

1. **Feedback apenas no header da conversa**
   - Prós: Simples, não polui mensagens
   - Contras: Feedback genérico, não específico por mensagem

2. **Botões like/dislike em hover (escolhida)**
   - Prós: Não polui UI, feedback específico por mensagem, padrão conhecido (ChatGPT)
   - Contras: Menos descobrível (requer hover)

3. **Botões sempre visíveis**
   - Prós: Alta descobribilidade
   - Contras: Poluição visual, distração

### Decisão

**Implementar botões like/dislike que aparecem em hover** sobre cada mensagem da IA.

**Arquitetura:**
- Botões aparecem apenas em mensagens da IA (não do usuário/atendente)
- Hover sobre mensagem exibe thumb-up e thumb-down
- Feedback negativo abre modal para comentário opcional
- Storage em `message_feedbacks` com context JSON

### Implementação

**Features:**
- ✅ Botões aparecem apenas em hover
- ✅ Feedback positivo: 1 clique (thumb-up)
- ✅ Feedback negativo: abre modal para comentário
- ✅ Estado visual (botão fica destacado após feedback)
- ✅ Context JSON armazena tenant_id, conversation_id, etc.

**Componente criado:**
- `MessageFeedbackButtons` - Botões like/dislike
- API route `/api/feedback/message` - Salvar feedback

**Tabela:**
```sql
message_feedbacks (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  user_id UUID REFERENCES users(id),
  rating TEXT CHECK (positive, negative),
  comment TEXT,
  context JSONB,
  created_at TIMESTAMP
)
```

### Consequências

**Positivas:**
✅ Feedback específico por mensagem
✅ UI clean (não polui visualmente)
✅ Padrão conhecido (ChatGPT, Claude)
✅ Comentário opcional para feedback negativo
✅ Rastreabilidade completa (context JSON)

**Negativas:**
⚠️ Menos descobrível (requer hover)
⚠️ Mobile pode ter dificuldade com hover

**Trade-offs aceitos:**
- Descobribilidade vs UI limpa → UI limpa vence
- Hover vs Sempre visível → Hover vence (desktop-first MVP)

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Hover exibe botões corretamente
✅ Feedback salva no banco
✅ Context JSON completo

### Referências
- [ChatGPT Feedback Pattern](https://openai.com/blog/chatgpt)
- Gap #3 identificado em MVP_CONTRAST_ANALYSIS.md

---

## Decisão #016: CRM Kanban Board com Tags

**Data:** 2025-11-24

**Status:** ✅ Implementado

### Contexto

Necessidade de organizar conversas além de status (open/paused/closed). Usuários precisam categorizar por tipo de problema, prioridade, ou outro critério customizável. Surgiu a questão: usar tags ou criar novos status?

### Opções Consideradas

1. **Novos status customizáveis**
   - Prós: Simples, um campo só
   - Contras: Limitado a 1 categoria por conversa, não escalável

2. **Tags many-to-many (escolhida)**
   - Prós: Múltiplas tags por conversa, flexível, escalável
   - Contras: Mais complexo (tabela associativa)

3. **Labels fixos predefinidos**
   - Prós: Simplicidade
   - Contras: Não customizável, não atende necessidades variadas

### Decisão

**Implementar sistema de tags many-to-many** com board Kanban onde cada tag é uma coluna.

**Arquitetura:**
- Tabela `conversation_tags` (id, name, color, order, tenant_id)
- Tabela `conversation_tag_associations` (conversation_id, tag_id)
- Board Kanban com coluna por tag
- Conversas podem ter múltiplas tags
- Cada coluna mostra conversas com aquela tag

### Implementação

**Features:**
- ✅ CRUD de tags (nome, cor, ordem)
- ✅ Associação many-to-many (conversa ↔ tags)
- ✅ Board Kanban com colunas dinâmicas
- ✅ Card de conversa mostra tags associadas
- ✅ Filtros por status e busca
- ✅ Drag-and-drop preparatório
- ✅ RLS policies completas

**Componentes criados:**
- `CRMKanbanBoard` - Board principal
- `CRMKanbanColumn` - Coluna por tag
- `CRMConversationCard` - Card de conversa
- `CRMFilters` - Filtros de status/busca

**Migrações:**
- `006_create_conversation_tags.sql` - Tabelas
- `007_alter_tags_add_order_color.sql` - Ordem e cor
- `008_add_tags_rls.sql` - Políticas RLS

### Consequências

**Positivas:**
✅ Flexibilidade: múltiplas tags por conversa
✅ Escalável: adicionar tags sem limite
✅ Customizável: cada tenant define suas tags
✅ Visual: cores personalizadas por tag
✅ Organização: colunas ordenáveis

**Negativas:**
⚠️ Complexidade: 2 tabelas + joins
⚠️ Performance: queries com múltiplos joins
⚠️ Drag-and-drop: preparado mas não finalizado

**Trade-offs aceitos:**
- Simplicidade vs Flexibilidade → Flexibilidade vence
- Performance vs Features → Features (otimizar depois)

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Build production (sucesso)
✅ RLS policies isolam tenants
✅ Tags aparecem corretamente no board

### Referências
- [Trello Board Pattern](https://trello.com)
- [Linear Issue Tags](https://linear.app)

---

## Decisão #017: Conversation Summary Modal

**Data:** 2025-11-24

**Status:** ✅ Implementado

### Contexto

Durante atendimento, atendentes precisam visualizar rapidamente dados extraídos da conversa (nome, telefone, email, etc.) sem reler todas as mensagens. Surgiu a questão: onde exibir esses dados?

### Opções Consideradas

1. **Painel lateral sempre visível**
   - Prós: Visibilidade máxima
   - Contras: Ocupa espaço permanentemente, UI poluída

2. **Modal sob demanda (escolhida)**
   - Prós: Acesso rápido (botão no header), não polui UI
   - Contras: Requer clique extra

3. **Tooltip em hover**
   - Prós: Sem clique
   - Contras: Difícil exibir muitos dados, não copiável

### Decisão

**Implementar modal acionado por botão no header** da conversa.

**Arquitetura:**
- Botão "Resumo" no header da conversa
- Modal exibe dados extraídos do contact
- Campos: nome, telefone, email, metadata JSON
- Botão copiar para clipboard
- Seções: Dados do Cliente, Memória, Pendências

### Implementação

**Features:**
- ✅ Botão no header abre modal
- ✅ Display de campos estruturados
- ✅ Metadata JSON formatado
- ✅ Funcionalidade copiar
- ✅ Seções organizadas
- ✅ Empty states quando sem dados

**Componentes criados:**
- `ConversationSummaryModal` - Modal principal
- `CustomerDataPanel` - Painel de dados

**Dados exibidos:**
```typescript
{
  name: string,
  phone: string,
  email: string,
  extracted_data: {
    cpf?: string,
    address?: string,
    preferences?: object,
    // ... customizável por tenant
  }
}
```

### Consequências

**Positivas:**
✅ Acesso rápido: 1 clique no header
✅ UI limpa: não ocupa espaço permanente
✅ Copiável: fácil transferir dados
✅ Extensível: metadata JSON aceita qualquer estrutura

**Negativas:**
⚠️ Requer clique (não visível automaticamente)
⚠️ Pode ficar desatualizado (não realtime)

**Trade-offs aceitos:**
- Visibilidade vs UI limpa → UI limpa vence
- Realtime vs Simplicidade → Simplicidade (MVP)

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Modal abre corretamente
✅ Dados exibem formatados
✅ Copiar funciona

### Referências
- Gap identificado durante debug de conversas

---

## Decisão #018: Profile Page com AI Global Pause Control

**Data:** 2025-11-27

**Status:** ✅ Implementado

### Contexto

Necessidade de página de perfil para exibir dados do usuário e tenant. Surgiu também a necessidade crítica de **pausar TODA a IA do tenant** (não apenas conversas individuais) para manutenções ou emergências.

### Opções Consideradas

1. **Pause apenas no nível conversa**
   - Prós: Já implementado
   - Contras: Não permite pause global (precisa pausar 1 por 1)

2. **Pause global com confirmação simples**
   - Prós: Rápido
   - Contras: Perigoso (pode ser acionado por engano)

3. **Pause global com confirmação de segurança (escolhida)**
   - Prós: Seguro, evita acidentes
   - Contras: Mais cliques (mas justificado)

### Decisão

**Implementar página /perfil com controle global de IA** que requer confirmação de segurança (digitar "PAUSAR").

**Arquitetura:**
- Switch para pausar/retomar IA global
- Confirmação modal: usuário deve digitar "PAUSAR"
- Persiste em campo `ai_paused` no tenant
- n8n verifica esse campo antes de processar mensagens
- Afeta TODAS as conversas do tenant

### Implementação

**Features:**
- ✅ Página `/perfil` com dados do usuário
- ✅ Avatar, nome, email, tenant
- ✅ Switch "Pausar IA Globalmente"
- ✅ Modal de confirmação (digitar "PAUSAR")
- ✅ Persiste no banco (`tenants.ai_paused`)
- ✅ Botão logout

**Componentes criados:**
- `AIControl` - Switch + confirmação
- `/perfil/page.tsx` - Página de perfil

**Fluxo:**
```
1. Admin clica switch "Pausar IA"
2. Modal abre: "Digite PAUSAR para confirmar"
3. Admin digita "PAUSAR"
4. UPDATE tenants SET ai_paused = true
5. n8n ignora todas mensagens desse tenant
6. Conversas continuam abertas, mas IA não responde
```

### Consequências

**Positivas:**
✅ Controle granular: pause global vs pause por conversa
✅ Segurança: confirmação evita acidentes
✅ Emergências: pode pausar tudo em <10 segundos
✅ Manutenções: facilita updates sem fechar conversas

**Negativas:**
⚠️ Confirmação adiciona fricção (mas necessário)
⚠️ Pode confundir clientes (IA para de responder subitamente)

**Trade-offs aceitos:**
- Velocidade vs Segurança → Segurança vence
- Simplicidade vs Controle → Controle vence

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ Modal de confirmação funciona
✅ Persistência no banco confirmada
✅ Campo valida "PAUSAR" exatamente

### Referências
- Commit: `749e943 - Implemented pause IA`
- Necessidade identificada durante debug de produção

---

## Decisão #019: Auto-Pause IA When Attendant Sends Message

**Data:** 2025-11-23

**Status:** ✅ Implementado

### Contexto

Quando atendente humano assume conversa e envia mensagem, a IA não deve responder imediatamente depois. Surgiu a questão: pausar IA automaticamente ou exigir pause manual?

### Opções Consideradas

1. **Pause manual (antes)**
   - Prós: Controle explícito
   - Contras: Atendente esquece, IA e humano respondem juntos (confusão)

2. **Auto-pause ao enviar mensagem (escolhida)**
   - Prós: Evita conflito automático, UX fluida
   - Contras: Pode pausar quando não desejado (raro)

3. **Pergunta de confirmação**
   - Prós: Controle explícito
   - Contras: Fricção, delay no envio

### Decisão

**Implementar auto-pause da IA** quando atendente envia mensagem.

**Arquitetura:**
- Ao enviar mensagem via input do livechat
- Sistema atualiza `ia_active = false` na conversa
- n8n para de processar mensagens dessa conversa
- Badge visual muda para "IA Pausada"
- Atendente pode retomar IA manualmente depois

### Implementação

**Fluxo:**
```
1. Atendente digita mensagem no input
2. Clica "Enviar"
3. Sistema salva mensagem no banco
4. Sistema atualiza: UPDATE conversations SET ia_active = false
5. Sistema chama webhook n8n para enviar ao WhatsApp
6. Badge muda para "IA Pausada" (amarelo)
7. IA para de responder
8. Atendente continua conversando
9. Quando terminar, clica "Retomar IA"
```

**Arquivos modificados:**
- `components/livechat/message-input.tsx` - Lógica de auto-pause
- `app/api/n8n/send-message/route.ts` - UPDATE ia_active

### Consequências

**Positivas:**
✅ Evita conflito automático (IA + humano respondendo junto)
✅ UX fluida (sem confirmação adicional)
✅ Previne confusão do cliente
✅ Lógica simples e previsível

**Negativas:**
⚠️ Pode pausar quando atendente só quer enviar nota interna (raro)
⚠️ Requer retomar IA manualmente depois

**Trade-offs aceitos:**
- Controle explícito vs Automação → Automação vence
- Confirmação vs Velocidade → Velocidade vence

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ IA pausa ao enviar mensagem
✅ Badge atualiza automaticamente
✅ Retomar funciona corretamente

### Referências
- Commit: `1a4e25d - Auto-pause IA when attendant sends message`
- Necessidade identificada em testes de UX

---

## Decisão #020: Conversation Tags Management System

**Data:** 2025-11-24

**Status:** ✅ Implementado

### Contexto

Sistema de tags foi criado para CRM Kanban Board (Decisão #016). Durante implementação, surgiu necessidade de gerenciar tags de forma robusta: ordenação, cores, CRUD completo, e RLS para multi-tenant.

### Opções Consideradas

1. **Tags hardcoded no código**
   - Prós: Simples, sem CRUD
   - Contras: Não customizável, precisa deploy para mudar

2. **Tags configuráveis por tenant (escolhida)**
   - Prós: Flexível, cada tenant define suas tags
   - Contras: Requer CRUD, tabelas, RLS

3. **Tags globais compartilhadas**
   - Prós: Simples, menos dados
   - Contras: Não atende multi-tenant, sem isolamento

### Decisão

**Implementar sistema completo de tags** com CRUD, ordenação, cores, e RLS multi-tenant.

**Arquitetura:**
- Tabela `conversation_tags` com campos: name, color, order, is_active, tenant_id
- Tabela `conversation_tag_associations` (many-to-many)
- RLS policies isolam tags por tenant
- Order permite reordenar colunas no Kanban
- Color permite personalização visual

### Implementação

**Features:**
- ✅ CRUD completo de tags
- ✅ Campo `order` (INT) para ordenação customizada
- ✅ Campo `color` (TEXT) para hex colors (#FF5733)
- ✅ Campo `is_active` para soft delete
- ✅ RLS policies completas
- ✅ Queries otimizadas com JOINs

**Migrações:**
```sql
-- 006: Criar tabelas
CREATE TABLE conversation_tags (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 007: Adicionar order e color
ALTER TABLE conversation_tags
  ADD COLUMN order INT DEFAULT 0,
  ADD COLUMN color TEXT DEFAULT '#6B7280';

-- 008: RLS policies
CREATE POLICY "Tenants can view their tags"
  ON conversation_tags FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

### Consequências

**Positivas:**
✅ Customizável: cada tenant cria suas tags
✅ Ordenável: drag-and-drop de colunas (preparado)
✅ Visual: cores personalizadas
✅ Seguro: RLS isola tenants
✅ Escalável: sem limite de tags

**Negativas:**
⚠️ Complexidade: 2 tabelas + RLS + queries complexas
⚠️ Performance: JOINs podem ser lentos (otimizar depois)

**Trade-offs aceitos:**
- Simplicidade vs Flexibilidade → Flexibilidade vence
- Performance vs Features → Features (MVP)

### Testes Realizados

✅ TypeScript type-check (zero erros)
✅ RLS policies isolam tenants corretamente
✅ Tags aparecem no CRM board
✅ Order funciona (reordenação visual)

### Referências
- Decisão #016: CRM Kanban Board com Tags
- Migrations: 006, 007, 008

---

## Decisões Rápidas

**Data** | **Decisão** | **Justificativa**
---------|-------------|------------------
2025-11-16 | shadcn/ui para componentes | Consistência visual, acessibilidade, manutenção facilitada
2025-11-16 | Server Components por padrão | Melhor performance, menor bundle, acesso direto a dados
2025-11-18 | Sidebar modo icon no livechat | Layout de 3 colunas requer mais espaço horizontal
2025-11-18 | CRUD simples para synapses | Simplicidade, offline-first, n8n em background
2025-11-19 | Neurocore com modo mock | Desenvolvimento frontend independente do n8n
2025-11-19 | Estado local (não persistir queries) | Simplicidade MVP, histórico não crítico
2025-11-19 | react-markdown para respostas | Padrão de mercado, seguro, 12M downloads/sem
2025-11-19 | Modal aninhado para hierarquia | Alinha MVP, reutiliza componentes, mantém contexto
2025-11-19 | Callbacks para refresh local | UX fluida sem fechar modal, SOLID (OCP/DIP)
2025-11-19 | API route para synapses | Client component precisa fetch, não pode usar server queries
2025-11-20 | Salvar no banco primeiro (Livechat) | Reduz delay de 500-1000ms para 100-200ms, UX superior
2025-11-22 | 4 filtros no Livechat | Visualizar conversas em qualquer estado, "Todas" inclui closed
2025-11-22 | Cards por Conversa (Refatoração Futura) | Card = conversa (não contato). Múltiplas conversas = múltiplos cards. Ver LIVECHAT_CONVERSATION_CARDS_REFACTOR.md
2025-11-23 | Auto-pause IA ao enviar mensagem | Evita conflito IA+humano respondendo junto, UX fluida
2025-11-23 | Message feedback em hover | UI limpa, padrão ChatGPT, feedback específico por mensagem
2025-11-24 | Tags many-to-many para CRM | Múltiplas tags por conversa, flexível, customizável por tenant
2025-11-24 | Conversation Summary modal | Acesso rápido a dados do cliente sem poluir UI
2025-11-26 | Comando "/" para quick replies | Atalho rápido (Slack/Discord pattern), não intrusivo
2025-11-27 | Profile page com AI pause global | Controle system-wide, confirmação de segurança ("PAUSAR")
2026-03-20 | Design tokens em CSS (surface-container-*, on-surface-variant) | Uma fonte em `globals.css`, sem hex em TSX; ver [design-tokens.md](./design-tokens.md)

---

## Decisão #021: Design tokens e cores (Stitch / Material 3)

**Data:** 2026-03-20

**Status:** Aceita

### Contexto

Referências visuais (Stitch) usam nomenclatura Material 3 e cores hex em HTML puro. O projeto usa Next.js, Tailwind v4 e shadcn — as cores devem permanecer centralizadas e sem valores hardcoded em componentes.

### Decisão

1. Estender `:root` / `.dark` em `app/globals.css` com tokens semânticos (`--surface`, `--surface-container-*`, `--on-surface-variant`, `--outline-variant`, `--primary-container`, `--on-primary-container`).
2. Expor tokens ao Tailwind via `@theme inline` (`--color-*`).
3. Manter tokens shadcn existentes (`primary`, `card`, `muted`, etc.) para compatibilidade.
4. Documentar mapeamento e uso em [design-tokens.md](./design-tokens.md).

### Consequências

- Ajustes de marca: editar apenas variáveis CSS.
- Novos componentes devem preferir classes baseadas em tokens (`bg-surface-container-low`, `text-on-surface-variant`) em vez de hex.
