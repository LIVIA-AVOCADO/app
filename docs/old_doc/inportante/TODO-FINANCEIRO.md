# TODO — Sistema Financeiro LIVIA

## Fase 1: Middleware de Assinatura + Layout Warning
- [x] 1.1 Ajustar `middleware.ts` — check de assinatura Edge Runtime, cache cookie 5min
- [x] 1.2 Warning banner no layout — amarelo (vence em X dias), vermelho (past_due)
- [x] 1.3 Remover página `/financeiro/assinatura` e subitem do nav

## Fase 2: Recarga Fracionada (Custom Amount)
- [x] 2.1 Criar `CustomAmountInput` — input monetário BR, min R$40, preview créditos
- [x] 2.2 Atualizar recharge page — pacotes + seção valor personalizado + histórico collapsible
- [x] 2.3 Atualizar Zod schema — aceitar `customAmountCents` (4000-500000)
- [x] 2.4 Atualizar checkout API — rota para custom amounts
- [x] 2.5 Atualizar helpers — metadata `is_custom: true`

## Fase 3: Dashboard Financeiro UI/UX
- [x] 3.1 Redesign wallet-balance-card — remover Manutenção, hero balance contextual, estimativa
- [x] 3.2 Layout 2 colunas no wallet-dashboard + TanStack Query
- [x] 3.3 Criar balance-forecast-card — gauge + alerta < 7 dias
- [x] 3.4 Destaque pacote R$1.000 como "Mais Popular"

## Fase 4: Auto-Recharge
- [x] 4.1 SQL migration para `auto_recharge_configs`
- [x] 4.2 API CRUD auto-recharge (GET/POST/DELETE)
- [x] 4.3 Setup Intent para salvar cartão
- [x] 4.4 Componente UI auto-recharge (3 estados: inativo/ativo/erro)
- [x] 4.5 Lógica de trigger (processAutoRecharge)
- [x] 4.6 Webhook handler para PaymentIntent
- [x] 4.7 Badge no wallet-balance-card

## Fase 5: Extrato — Filtros + CSV + Resumo
- [x] 5.1 Filtro por conversa no extrato
- [x] 5.2 Filtro por conversa no consumo
- [x] 5.3 Presets de data (Hoje, 7d, 30d, Este mês)
- [x] 5.4 Card de resumo do período
- [x] 5.5 Exportar CSV

## Fase 6: Consumo — Comparação + Projeção
- [x] 6.1 Comparação com período anterior
- [x] 6.2 Projeção de gastos mensal
- [x] 6.3 Tooltip melhorado + linha de média no gráfico

## Fase 7: Consistência e Polish
- [x] 7.1 Remover página/componente de Alertas
- [x] 7.2 Padronizar layouts (max-w-5xl)
- [x] 7.3 Migrar dashboards para TanStack Query
