# Plano: Redução de Densidade Visual e Ações Contextuais no Livechat

**Data:** 2026-03-18
**Status:** Planejado — aguardando aprovação
**Objetivo:** Reduzir elementos sempre renderizados, mover ações para contextos mais adequados e ganhar espaço para o conteúdo principal (mensagens).

---

## Índice

1. [Diagnóstico da UI atual](#1-diagnóstico-da-ui-atual)
2. [Análise de mercado](#2-análise-de-mercado)
3. [Visão geral das mudanças propostas](#3-visão-geral-das-mudanças-propostas)
4. [Fase A — Ellipsis no card (ContactItem)](#fase-a--ellipsis-no-card-contactitem)
5. [Fase B — Header consolidado + toggle do painel](#fase-b--header-consolidado--toggle-do-painel)
6. [Fase C — CustomerDataPanel como Sheet + modo fixado](#fase-c--customerdatapanel-como-sheet--modo-fixado)
7. [Prós e contras por decisão](#7-prós-e-contras-por-decisão)
8. [Dificuldades técnicas e mitigações](#8-dificuldades-técnicas-e-mitigações)
9. [Ordem de implementação](#9-ordem-de-implementação)
10. [Arquivos afetados](#10-arquivos-afetados)

---

## 1. Diagnóstico da UI atual

### Layout atual (3 colunas fixas)

```
┌─────────────────────┬──────────────────────────────┬──────────────────┐
│  ContactList        │  ConversationView             │ CustomerDataPanel│
│  384px fixo         │  flex-1                       │  320px fixo      │
│                     │  ┌────────────────────────┐   │                  │
│  [Busca]            │  │ Row 1: Nome + Resumo   │   │ [Dados do cliente│
│  [IA | Manual | ...]│  │         + Pausar IA    │   │  editáveis]      │
│  [Cards...]         │  │ Row 2: TagSelector     │   │                  │
│                     │  │ Row 3: Status + Badge  │   │                  │
│                     │  ├────────────────────────┤   │                  │
│                     │  │   Mensagens            │   │                  │
│                     │  │   (área principal)     │   │                  │
│                     │  ├────────────────────────┤   │                  │
│                     │  │   MessageInput         │   │                  │
│                     │  └────────────────────────┘   │                  │
└─────────────────────┴──────────────────────────────┴──────────────────┘
```

### Problemas identificados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | `CustomerDataPanel` sempre renderizado (371 linhas, fetch imediato) mesmo quando não está sendo usado | Render e fetch desnecessários |
| 2 | Header com 3 linhas: Resumo + Pausar IA ficam expostos mesmo sendo ações pouco frequentes | Densidade visual alta |
| 3 | Não há como marcar uma conversa como não lida (ação comum em ferramentas de suporte) | Gap de funcionalidade |
| 4 | Ações de conversa (tags, status) acessíveis apenas após abrir a conversa | Fluxo lento para triagem |
| 5 | `CustomerDataPanel` ocupa 320px fixos — em notebooks (1366px) resta ~660px para mensagens | Espaço comprometido |

---

## 2. Análise de mercado

### Como as principais ferramentas resolvem isso

| Ferramenta | Card de contato | Painel lateral | Header |
|------------|-----------------|----------------|--------|
| **WhatsApp Web** | Sem ações no card | Abre ao clicar no avatar/nome, desliza, não fixado | Limpo: só nome + ações no `⋮` |
| **Intercom** | Menu de contexto no hover (`⋮`) | Toggleável, pode ser "pinado" por usuário | Ações principais visíveis, raras no `⋮` |
| **Zendesk** | Sem ações no card | Coluna direita colapsável, estado persistido | Ações secundárias no `⋮` |
| **Freshdesk** | `⋮` com snooze, assign, status | Sheet lateral deslizante | Poucas ações visíveis |
| **Linear** | Hover revela ações rápidas | Painel de detalhes toggleável (`Ctrl+.`) | Ações agrupadas em toolbar |
| **Front** | `⋮` com assign, snooze, mark unread | Painel lateral colapsável | Ações frequentes + `⋮` para raras |

### Padrões consolidados do mercado

1. **Ações raras ficam no `⋮`** (Resumo da conversa, Pausar IA)
2. **Ações frequentes ficam visíveis** (TagSelector — deve ficar visível)
3. **Painel lateral é toggleável**, com opção de fixar (Intercom, Zendesk)
4. **"Marcar como não lida"** é padrão universal em ferramentas de atendimento
5. **O card mostra contexto mínimo** — ações aparecem no hover

---

## 3. Visão geral das mudanças propostas

### Layout alvo

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│  ContactList        │  ConversationView                                 │
│  384px fixo         │  flex-1 (muito mais espaço para mensagens)        │
│                     │  ┌──────────────────────────────────────────────┐ │
│  [Busca]            │  │ Nome | [⋮ menu: Resumo, Pausar IA, ...] [👤] │ │
│  [IA | Manual | ...]│  │ TagSelector (mantido visível)                 │ │
│                     │  │ Status + Badge                                │ │
│  [Card com ⋮] ←     │  ├──────────────────────────────────────────────┤ │
│  [Card com ⋮]       │  │   Mensagens                                  │ │
│  [Card com ⋮]       │  │   (área principal — maior que antes)         │ │
│                     │  ├──────────────────────────────────────────────┤ │
│                     │  │   MessageInput                               │ │
│                     │  └──────────────────────────────────────────────┘ │
└─────────────────────┴──────────────────────────────────────────────────┘
                                           ↓ ao clicar em [👤]
                              ┌─────────────────────────────────────────┐
                              │ Sheet deslizante: CustomerDataPanel      │
                              │ [📌 Fixar painel] no topo               │
                              │ (se fixado: vira coluna lateral direita) │
                              └─────────────────────────────────────────┘
```

---

## Fase A — Ellipsis no card (ContactItem)

### O que muda

Cada `ContactItem` ganha um botão `⋮` (`MoreVertical`) que aparece no **hover ou quando selecionado**. Ao clicar, abre um `DropdownMenu` com:

| Ação | Descrição | API |
|------|-----------|-----|
| 🏷️ Adicionar tag | Abre submenu ou popover com tags disponíveis | `POST /api/conversations/tags` |
| 📭 Marcar como não lida | Define `has_unread=true`, `unread_count` incrementado | `POST /api/conversations/mark-as-unread` (novo) |
| ✅ Encerrar conversa | Altera status para `closed` | `PATCH /api/conversations/:id/status` (existente) |

### O que NÃO vai para o ellipsis do card

- "Resumo da conversa" — contextual, faz mais sentido após abrir a conversa
- "Pausar IA" — ação que requer confirmação, melhor no header

### Wireframe do card com ellipsis

```
┌────────────────────────────────────────────┐
│ 👤  João Silva          [⋮]   há 5 min    │  ← ⋮ aparece no hover
│     "Olá, tenho uma dúvida sobre..."       │
│     [Tag: Intenção] [Tag: Checkout]        │
│     [IA Ativa]                             │
└────────────────────────────────────────────┘
                              ↓ clique no ⋮
                    ┌─────────────────────┐
                    │ 🏷️ Adicionar tag    │
                    │ 📭 Marcar não lida  │
                    │ ─────────────────── │
                    │ ✅ Encerrar         │
                    └─────────────────────┘
```

### Decisões de implementação

- O botão `⋮` usa `e.stopPropagation()` para não acionar o `onClick` do card
- O `React.memo` do `ContactItem` **não precisa ser alterado** — o estado do menu fica no `DropdownMenu` (uncontrolled pelo Radix)
- O `arePropsEqual` pode continuar igual — Radix gerencia o open state internamente
- Props novas em `ContactItemProps`:
  ```typescript
  onMarkUnread?: () => void;
  onQuickTag?: () => void;
  onClose?: () => void;
  ```
- As callbacks são passadas pelo `ContactList`, que já tem acesso ao `tenantId`

### Nova API necessária: mark-as-unread

```typescript
// POST /api/conversations/mark-as-unread
// Body: { conversationId, tenantId }
// Ação: conversations SET has_unread=true, unread_count=1 WHERE id=conversationId
```

---

## Fase B — Header consolidado + toggle do painel

### O que muda no `ConversationHeader`

**Antes (Row 1):**
```
[Nome do Contato]    [📄 Resumo da Conversa]  [⏸️ Pausar IA]
```

**Depois (Row 1):**
```
[Nome do Contato]                            [⋮]  [👤 Dados]
```

O `[⋮]` abre um `DropdownMenu` com:

| Ação | Antes | Depois |
|------|-------|--------|
| Resumo da conversa | Botão visível | Item do `⋮` |
| Pausar IA | Botão visível | Item do `⋮` |
| Retomar IA | (não existia explicitamente) | Item do `⋮` (aparece quando IA pausada) |

O `[👤]` é um `Button` que **toggle** a visibilidade do `CustomerDataPanel`.

**Row 2 e Row 3:** mantidas exatamente como estão.

### Por que TagSelector fica visível?

- É a ação mais frequente do header (triagem de conversas)
- Esconder no `⋮` adicionaria 2 cliques para uma ação de workflow central
- Padrão de mercado: ações frequentes permanecem expostas

### Interface do DropdownMenu do header

```
┌──────────────────────────────┐
│ 📄 Resumo da conversa        │
│ ──────────────────────────── │
│ ⏸️  Pausar IA                │  ← item desabilitado se IA já pausada
│ ▶️  Retomar IA               │  ← item desabilitado se IA ativa
└──────────────────────────────┘
```

### Estado do botão [👤]

- Inativo: ícone `User` com estilo `ghost`
- Ativo (painel visível): ícone com background `bg-primary/10` e borda `border-primary/20`
- Tooltip: "Dados do cliente"

---

## Fase C — CustomerDataPanel como Sheet + modo fixado

### Comportamento padrão (não fixado)

- Painel não renderizado por padrão (zero render, zero fetch)
- Ao clicar em `[👤]` no header: abre `Sheet` deslizando da direita
- `Sheet` tem `side="right"` e `className="w-80"`
- Clicar fora ou pressionar `Esc` fecha
- Ao fechar, componente é desmontado (sem leak de estado)

### Modo fixado (pinned)

- Dentro do `Sheet`, no topo: botão `📌 Fixar painel` / `📌 Desafixar`
- Quando fixado:
  - O `Sheet` fecha
  - O `CustomerDataPanel` passa a ser renderizado como coluna lateral direita (comportamento atual)
  - O botão `[👤]` no header fica com estilo "ativo permanente"
- Preferência salva em `localStorage` (chave: `livechat:panel:pinned`)
- Ao recarregar a página com painel fixado: coluna já aparece sem necessidade de clicar

### Estados possíveis

```
Estado 1: Painel oculto (padrão)
  [👤] → inativo, sem coluna lateral

Estado 2: Sheet aberto (clicou em [👤], não fixado)
  [👤] → ativo, Sheet deslizando da direita

Estado 3: Painel fixado (toggle de pin)
  [👤] → ativo permanente, coluna lateral visível
```

### Gerenciamento de estado em `livechat-content.tsx`

```typescript
// Estado do painel
const [isPanelOpen, setIsPanelOpen] = useState(false);
const [isPanelPinned, setIsPanelPinned] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('livechat:panel:pinned') === 'true';
});

const handlePinToggle = () => {
  const next = !isPanelPinned;
  setIsPanelPinned(next);
  localStorage.setItem('livechat:panel:pinned', String(next));
  if (next) setIsPanelOpen(false); // Sheet fecha, vira coluna
};
```

### Transição entre modos

- Sheet → coluna: `Sheet` fecha (animação out) → coluna aparece (fade-in)
- Coluna → Sheet: coluna desaparece → Sheet abre (animação in)
- Animação máxima: 200ms (consistente com shadcn/ui defaults)

---

## 7. Prós e contras por decisão

### Ellipsis no card

| Prós | Contras |
|------|---------|
| Aciona "marcar não lida" sem abrir conversa | Ações menos descobríveis (hidden behind `⋮`) |
| Triagem mais rápida (tag, fechar sem abrir) | Mais props no ContactItem (interface maior) |
| Padrão de mercado bem estabelecido | Requer nova API mark-as-unread |
| Não impacta performance (menu uncontrolled pelo Radix) | Teste de UX necessário (hover intent) |

### Header consolidado

| Prós | Contras |
|------|---------|
| Header mais limpo (de 3 rows para visual menos denso) | Resumo/Pausar IA ficam menos óbvios |
| TagSelector permanece exposto (correto) | Usuários atuais precisam se adaptar |
| Botão `[👤]` torna toggle explícito | |

### CustomerDataPanel como Sheet + pin

| Prós | Contras |
|------|---------|
| +320px de espaço para mensagens por padrão | Usuários que usam o painel frequentemente sofrem até pinnar |
| Zero render e zero fetch enquanto fechado | Necessidade de localStorage (SSR-safe) |
| Padrão de mercado (Intercom, Zendesk, Freshdesk) | Transição entre Sheet e coluna pode ser visual jarrante se não bem animado |
| Estado persistido: re-abre como o usuário deixou | |

---

## 8. Dificuldades técnicas e mitigações

### D1 — `React.memo` no `ContactItem`

**Problema:** `ContactItem` usa `memo` com `arePropsEqual` customizado. Adicionar callbacks novos (`onMarkUnread`, `onQuickTag`, `onClose`) significa que a referência das funções muda a cada render do pai, quebrando a memoização.

**Mitigação:** Envolver os callbacks com `useCallback` no `ContactList`. Como `ContactList` já acessa `tenantId` e `onConversationClick`, o mesmo padrão se aplica.

### D2 — Marcar como não lida: estado Realtime

**Problema:** Ao marcar como não lida via API, o `has_unread` e `unread_count` precisam atualizar na lista. O Realtime já escuta `conversations.*` — se a query de `mark-as-unread` atualizar esses campos no banco, o Realtime propagará automaticamente.

**Mitigação:** A API de `mark-as-unread` faz um `UPDATE conversations SET has_unread=true, unread_count=COALESCE(unread_count,0)+1` — o Realtime detecta e atualiza a lista. Zero polling necessário.

### D3 — SSR-safe para `localStorage` (panel pinned)

**Problema:** `localStorage` não existe no servidor. Leitura no `useState` initializer crasha no SSR.

**Mitigação:** Usar initializer com guard `typeof window !== 'undefined'` (já mostrado no plano). O valor correto é lido apenas no browser na primeira hidratação — sem flash porque o SSR renderiza `isPanelPinned=false` e o cliente inicializa com o valor do localStorage antes do primeiro paint (via `useState(() => ...)`).

**Atenção:** Pode haver um flash de layout (coluna aparece/desaparece no hydrate). Mitigação adicional: usar `useLayoutEffect` com `useState(false)` + `setIsPanelPinned(localStorage...)` para sincronizar antes do paint.

### D4 — Sheet + coluna lateral: dois modos de render

**Problema:** O `CustomerDataPanel` precisa funcionar tanto dentro de um `Sheet` quanto como coluna lateral. Se tiver estado interno (campos editados), trocar de modo reseta o estado.

**Mitigação:** O `CustomerDataPanel` já carrega fresh do servidor a cada montagem (`useApiCall` no mount). A troca de modo vai re-montar e re-fetch, o que é aceitável — os dados do contato raramente mudam em segundos. Alternativamente: chave (`key`) consistente entre modos para preservar estado.

### D5 — `e.stopPropagation()` no ellipsis do card

**Problema:** O `onClick` do `DropdownMenuTrigger` precisa parar a propagação para não acionar o `onClick` do card (que navega para a conversa).

**Mitigação:** Padrão Radix já lida com isso internamente para o Trigger. Mas o container `<div onClick={navigateToConversation}>` que envolve o card pode interceptar. Solução: o botão `⋮` usa `onPointerDown={e.stopPropagation()}` E `onClick={e.stopPropagation()}` para cobrir todos os casos.

### D6 — Acessibilidade do ellipsis no card

**Problema:** Usuários de teclado precisam acessar o menu do card sem passar pelo click no card.

**Mitigação:** `DropdownMenuTrigger` com `asChild` + `Button` com `aria-label="Opções da conversa"`. Radix já gerencia focus trap e keyboard navigation do menu (setas, Enter, Esc).

### D7 — Tag assignment a partir do card

**Problema:** A tela de "adicionar tag" no card precisa dos `allTags` disponíveis. O `ContactList` recebe `allTags` — pode passá-los para o `ContactItem`.

**Complicação:** A adição de tag via card modifica `conversation_tags` no banco → o Realtime atualiza o card automaticamente. Mas o `TagSelector` existente é pesado (tem busca, checkbox, etc.). Para o card, uma versão mais simples (popover com checkboxes flat) seria mais adequada.

**Decisão:** Usar um `Popover` leve com checkboxes diretos para as primeiras 10 tags. Sem busca no card (a busca existe no header ao abrir a conversa).

---

## 9. Ordem de implementação

Ordenado por **impacto / risco**:

```
Fase B.1 — Header: mover Resumo + Pausar IA para ⋮
  ↳ Baixo risco, alto impacto visual. Não quebra nada.
  ↳ Arquivos: conversation-header.tsx

Fase C — CustomerDataPanel como Sheet + pin
  ↳ Médio risco, alto valor (libera 320px + economia de render)
  ↳ Arquivos: livechat-content.tsx, conversation-header.tsx
  ↳ Novo comportamento: Sheet, localStorage, toggle state

Fase B.2 — Header: botão [👤] para toggle do painel
  ↳ Parte da Fase C (acontece junto)

Fase A — Ellipsis no card
  ↳ Médio risco (memo, propagation, nova API)
  ↳ Arquivos: contact-item.tsx, contact-list.tsx
  ↳ Nova API: /api/conversations/mark-as-unread
```

---

## 10. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `components/livechat/conversation-header.tsx` | Mover Resumo + Pausar IA para `DropdownMenu`, adicionar botão `[👤]` |
| `components/livechat/livechat-content.tsx` | Estado do painel (open + pinned), render condicional Sheet vs coluna |
| `components/livechat/contact-item.tsx` | Adicionar botão `⋮` + `DropdownMenu` + props de callback |
| `components/livechat/contact-list.tsx` | Passar callbacks `onMarkUnread`, `onQuickTag` com `useCallback` |
| `app/api/conversations/mark-as-unread/route.ts` | **Novo** — API para marcar como não lida |

### Componentes shadcn/ui utilizados (já instalados)

| Componente | Uso |
|------------|-----|
| `DropdownMenu` | Ellipsis no card e no header |
| `Sheet` | CustomerDataPanel no modo não fixado |
| `Popover` | Tag selector simplificado no card (Fase A) |
| `Tooltip` | Tooltip no botão `[👤]` do header |

---

## Referências de design

- WhatsApp Web: painel lateral de contato (toggle no clique do nome)
- Intercom: painel direito colapsável com "pin"
- Zendesk: contextual actions no `⋮` do ticket
- Linear: sidebar de detalhes com `Ctrl+.` para toggle

---

*Documento criado em 2026-03-18. Atualizar status à medida que as fases forem implementadas.*
