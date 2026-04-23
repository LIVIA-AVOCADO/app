# Integração PIX — Mercado Pago + Stripe

**Atualizado:** 2026-04-13
**Status:** Em implementação

---

## Visão geral

O projeto suporta dois provedores de pagamento para assinatura e recargas de crédito:

| Provedor | Uso |
|---|---|
| **Stripe** | Assinatura mensal (cartão, débito automático) + recarga de créditos via cartão |
| **Mercado Pago** | Recarga de créditos via PIX avulso + assinatura mensal via PIX manual (com lembrete) |

**Regra central:** assinatura só pode estar ativa em **um provedor por vez**. Ativar um desativa o outro.

---

## Por que o PIX não está no Stripe

O Stripe suporta PIX apenas para contas com país configurado como Brasil (BR) E ativação manual pela equipe do Stripe. A conta atual não tem a opção disponível no painel de payment methods. Solução adotada: Mercado Pago para PIX.

---

## Estrutura de dados — tabela `tenants`

### Campos existentes (Stripe)
```
stripe_customer_id
stripe_subscription_id
subscription_status              -- active | past_due | canceled | trialing | inactive
subscription_current_period_end  -- data de vencimento atual
subscription_cancel_at_period_end
```

### Campos novos (migração 20260413)
```
subscription_provider    TEXT  DEFAULT 'stripe'  -- 'stripe' | 'pix_manual'
subscription_billing_day INTEGER                  -- dia do mês (1–31), espelho do billing_cycle_anchor do Stripe
```

---

## Ciclo de cobrança — dia fixo do mês

Tanto Stripe quanto PIX usam **dia fixo do mês** (`billing_cycle_anchor` no Stripe, `subscription_billing_day` no nosso DB).

- Cliente assina no dia 15 → vence sempre no dia 15
- Se o mês tem menos dias que o billing_day → vence no último dia do mês
- Meses de 28/29/30/31 dias tratados automaticamente por ambos os provedores

Isso garante política de cobrança idêntica independente do provedor.

---

## Fluxos de assinatura

### 1. Stripe (cartão) — fluxo atual, sem alteração

```
Cliente assina → Stripe Checkout → assinatura criada
Stripe cobra automaticamente no billing_cycle_anchor todo mês
Webhook customer.subscription.updated → atualiza subscription_current_period_end
```

### 2. PIX manual — novo

```
Cliente escolhe PIX → sistema gera PIX com valor da assinatura
PIX tem vencimento = subscription_billing_day do mês atual (ou próximo)
7 dias antes: lembrete automático por e-mail/notificação
Cliente paga → webhook MP confirma → subscription_current_period_end += 1 mês
Se não pagar até vencer → subscription_status = 'past_due'
```

---

## Troca de provedor

### Stripe → PIX (cliente com dias restantes)

```
1. Stripe: cancel_at_period_end = true
   → Stripe NÃO renova, mas mantém acesso até o period_end atual
2. subscription_provider = 'pix_manual'
3. subscription_billing_day = dia extraído do subscription_current_period_end
4. Cliente recebe lembrete 7 dias antes do period_end
5. Cliente paga PIX → novo período estendido a partir do period_end (não da data do pagamento)
   → Nenhum dia é perdido
```

### Stripe → PIX (cliente com assinatura past_due — cartão recusado)

```
RISCO: Stripe pode fazer retry automático (Smart Retry) por 4–7 dias
       Se o cartão receber saldo e o Stripe cobrar após o PIX ser pago → cobrança dupla

SOLUÇÃO:
1. Ao confirmar pagamento PIX → cancelar Stripe IMEDIATAMENTE (não cancel_at_period_end)
2. subscription_provider = 'pix_manual'
3. subscription_billing_day = dia do próximo vencimento
4. Stripe para os retries instantaneamente — assinatura cancelada não gera cobrança
```

### PIX → Stripe (cliente quer voltar ao cartão)

```
1. Criar nova Stripe Subscription com:
   - billing_cycle_anchor = subscription_current_period_end (mesmo dia)
   - trial_end = subscription_current_period_end (não cobra antes do vencimento atual)
2. subscription_provider = 'stripe'
3. Cancela controle manual do PIX
   → Stripe assume na data certa, sem cobrar em duplicidade
```

---

## Recarga de créditos via PIX (avulso)

Independente do provedor de assinatura, recargas de crédito **sempre** suportam PIX via Mercado Pago.

### Fluxo

```
Usuário seleciona pacote → clica "Pagar com PIX"
API cria pagamento MP → retorna QR code + copia-e-cola + validade
Usuário é redirecionado para /financeiro/checkout/pix?payment_id=xxx
Página exibe QR code com countdown (30 min)
Polling a cada 5s verifica status
Pago → credita wallet via RPC credit_wallet() → redireciona para sucesso
Webhook MP também credita (com idempotência — sem crédito duplo)
```

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/mercadopago/client.ts` | Singleton do cliente MP |
| `lib/mercadopago/pix.ts` | Criar pagamento PIX, verificar status |
| `app/api/mercadopago/pix/create/route.ts` | POST — cria pagamento PIX avulso |
| `app/api/mercadopago/pix/status/route.ts` | GET — verifica status do pagamento |
| `app/api/mercadopago/webhook/route.ts` | Recebe notificações MP (créditos + assinatura) |
| `app/(dashboard)/financeiro/checkout/pix/page.tsx` | Página com QR code e polling |

---

## Webhook Mercado Pago

### Eventos tratados

| Tipo | Ação |
|---|---|
| `payment` — status `approved`, metadata `type = credit_purchase` | Credita wallet via RPC |
| `payment` — status `approved`, metadata `type = subscription` | Cancela Stripe (se necessário) + estende período |
| `payment` — status `cancelled` ou `expired` | Atualiza status no DB |

### Segurança

Verificação de assinatura via header `x-signature` + `x-request-id` com HMAC-SHA256 usando o webhook secret do MP.

---

## Limites PIX — Mercado Pago

| | Valor |
|---|---|
| Mínimo | R$ 0,50 |
| Máximo por transação | R$ 3.000,00 |
| Expiração QR code | 30 minutos (configurável) |

---

## Variáveis de ambiente necessárias

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...   # configurado no painel MP após deploy
```

---

## Pendências

- [ ] Migration: `subscription_provider` + `subscription_billing_day` no `tenants`
- [ ] `lib/mercadopago/client.ts`
- [ ] `lib/mercadopago/pix.ts`
- [ ] `app/api/mercadopago/pix/create/route.ts`
- [ ] `app/api/mercadopago/pix/status/route.ts`
- [ ] `app/api/mercadopago/webhook/route.ts`
- [ ] `app/(dashboard)/financeiro/checkout/pix/page.tsx`
- [ ] UI: seleção de provedor na página de assinatura
- [ ] Cron: lembrete 7 dias antes do vencimento PIX
- [ ] Lógica de troca Stripe ↔ PIX (cancel/reactivate)
