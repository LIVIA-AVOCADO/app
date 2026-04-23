# Plano de Implementação: Melhorias UI/UX + Features do Sistema Financeiro

## Contexto
Sistema financeiro LIVIA funcional (8 páginas, 14+ componentes, Stripe v20.3.1 integrado). Precisa de: middleware de assinatura, recarga fracionada, auto-recharge, melhorias de UI/UX, remoção de páginas desnecessárias.

---

## Fase 1: Middleware de Assinatura + Layout Warning
**Arquivos:** `middleware.ts`, `app/(dashboard)/layout.tsx`, `components/layout/nav-items.tsx`
- 1.1 Ajustar `middleware.ts` — check de assinatura no Edge Runtime, cache via cookie 5min
- 1.2 Warning banner no layout — amarelo (vence em X dias), vermelho (past_due)
- 1.3 Remover página `/financeiro/assinatura` e subitem do nav

### Fase 2: Recarga Fracionada (Custom Amount)
**Arquivos:** `components/billing/custom-amount-input.tsx` (NOVO), `components/billing/recharge-page-content.tsx`, `app/api/stripe/checkout/route.ts`, `lib/validations/stripe-validation.ts`, `lib/stripe/helpers.ts`
- 2.1 Criar `CustomAmountInput` — input monetário BR, min R$40, preview créditos
- 2.2 Atualizar recharge page — pacotes destacados + seção valor personalizado + histórico collapsible
- 2.3 Atualizar Zod schema — aceitar `customAmountCents` (4000-500000)
- 2.4 Atualizar checkout API — rota para custom amounts
- 2.5 Atualizar helpers — metadata `is_custom: true`

### Fase 3: Dashboard Financeiro UI/UX
**Arquivos:** `components/billing/wallet-balance-card.tsx`, `components/billing/wallet-dashboard.tsx`, `components/billing/balance-forecast-card.tsx` (NOVO)
- 3.1 Redesign wallet-balance-card — remover seção Manutenção, hero balance contextual, estimativa duração
- 3.2 Layout 2 colunas no wallet-dashboard + TanStack Query
- 3.3 Criar balance-forecast-card — gauge + alerta < 7 dias
- 3.4 Destaque pacote R$1.000 como "Mais Popular"

### Fase 4: Auto-Recharge
**Arquivos:** SQL migration, `app/api/billing/auto-recharge/route.ts` (NOVO), `lib/stripe/setup-intent.ts` (NOVO), `lib/stripe/auto-recharge.ts` (NOVO), `components/billing/auto-recharge-config.tsx` (NOVO), `lib/stripe/webhook-handlers.ts`, `types/billing.ts`, `types/stripe.ts`
- 4.1 SQL para `auto_recharge_configs`
- 4.2 API CRUD auto-recharge (GET/POST/DELETE)
- 4.3 Setup Intent para salvar cartão
- 4.4 Componente UI auto-recharge (3 estados: inativo/ativo/erro)
- 4.5 Lógica de trigger (processAutoRecharge)
- 4.6 Webhook handler para PaymentIntent
- 4.7 Badge no wallet-balance-card

### Fase 5: Extrato — Filtros + CSV + Resumo
**Arquivos:** `lib/queries/billing.ts`, `components/billing/ledger-filters.tsx`, `components/billing/ledger-container.tsx`, `app/api/billing/ledger/route.ts`
- 5.1 Filtro por conversa no extrato
- 5.2 Filtro por conversa no consumo
- 5.3 Presets de data (Hoje, 7d, 30d, Este mês)
- 5.4 Card de resumo do período
- 5.5 Exportar CSV

### Fase 6: Consumo — Comparação + Projeção
**Arquivos:** `components/billing/usage-totals-cards.tsx`, `components/billing/cost-projection-card.tsx` (NOVO), `components/billing/usage-chart.tsx`, `app/api/billing/usage/route.ts`
- 6.1 Comparação com período anterior
- 6.2 Projeção de gastos mensal
- 6.3 Tooltip melhorado + linha de média no gráfico

### Fase 7: Consistência e Polish
**Arquivos:** `components/layout/nav-items.tsx`, vários componentes
- 7.1 Remover página/componente de Alertas
- 7.2 Padronizar layouts (max-w-5xl)
- 7.3 Migrar dashboards para TanStack Query

---

## Verificação (a cada fase)
1. `npx tsc --noEmit` — sem erros de tipo
2. `npx eslint .` — sem erros de lint
3. Atualizar `docs/TODO-FINANCEIRO.md` marcando tarefas concluídas
4. Após todas as fases: `npm run build` — build limpo
