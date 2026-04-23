# Plano de Cobertura de Testes — LIVIA MVP

> **Status:** ✅ Fases 1-5 concluídas — E2E aguardando setup do ambiente  
> **Criado em:** 2026-04-17  
> **Atualizado em:** 2026-04-17  
> **Objetivo:** Sanar o débito técnico de testes automatizados de forma incremental e sustentável

---

## Resumo do que foi implementado

| Fase | Tipo | Arquivos | Testes | Status |
|---|---|---|---|---|
| Fase 1 — Validações Zod | Unitário | 7 | 122 | ✅ Concluído |
| Fase 2 — Queries Supabase | Integração (mock) | 5 | 94 | ✅ Concluído |
| Fase 3 — API Routes | Integração (mock) | 8 | 74 | ✅ Concluído |
| Fase 4 — Componentes React | Unitário | 5 | 58 | ✅ Concluído |
| Fase 5 — E2E Playwright | E2E | 4 specs | 21 | ⏳ Infra pronta, aguarda setup |
| **Total** | | **25 + 4 specs** | **360 + 21** | |

---

## Como rodar

```bash
npm test                   # todos os testes unitários/integração (360 testes)
npm run test:watch         # modo watch durante desenvolvimento
npm run test:coverage      # relatório de cobertura
npm run test:ui            # interface visual do Vitest

npm run test:e2e:public    # E2E sem auth (login, redirects) — 7 testes
npm run test:e2e           # E2E completo — 21 testes (requer setup abaixo)
```

---

## Tipos de teste — o que cada um cobre

### Unitário
Testa uma função ou componente **isolado**, sem dependências externas.
- Fase 1 (validações Zod): schemas aceitam/rejeitam valores corretos
- Fase 4 (componentes React): renderização, cliques, estados

### Integração (com mock)
Testa **múltiplas camadas juntas**, mas serviços externos (Supabase, Stripe, n8n) são mockados.
- Fase 2 (queries): query layer + Supabase mockado
- Fase 3 (API routes): requisição HTTP → auth → validação → query → resposta

> O que é mockado: Supabase, Stripe, n8n  
> O que é real: lógica de negócio, validações, tratamento de erros

### E2E (End-to-End)
Simula um **usuário real no browser** — Chrome headless navega nas páginas, preenche formulários, clica em botões. Usa servidor real + banco real.
- Fase 5: login, redirects, livechat, financeiro, quick-replies

---

## Arquivos de teste criados

### Fase 1 — Validações (`lib/validations/__tests__/`)
| Arquivo | Testes |
|---|---|
| `stripe-validation.test.ts` | 13 |
| `tag-validation.test.ts` | 19 |
| `conversation-timeout-validation.test.ts` | 8 |
| `onboarding-validation.test.ts` | 24 |
| `reactivation-validation.test.ts` | 20 |
| `agent-schedule-validation.test.ts` | 19 |
| `agent-prompt-validation.test.ts` | 19 |

### Fase 2 — Queries (`lib/queries/__tests__/`)
| Arquivo | Testes |
|---|---|
| `billing.test.ts` | 29 |
| `stripe.test.ts` | 11 |
| `quick-replies.test.ts` | 24 |
| `contacts.test.ts` | 9 |
| `livechat.test.ts` | 21 |

### Fase 3 — API Routes (`app/api/*/__tests__/`)
| Arquivo | Testes |
|---|---|
| `billing/wallet/__tests__/route.test.ts` | 9 |
| `stripe/checkout/__tests__/route.test.ts` | 9 |
| `stripe/webhook/__tests__/route.test.ts` | 7 |
| `conversations/update-status/__tests__/route.test.ts` | 9 |
| `conversations/pause-ia/__tests__/route.test.ts` | 7 |
| `conversations/mark-as-read/__tests__/route.test.ts` | 6 |
| `quick-replies/__tests__/route.test.ts` | 16 |
| `livechat/messages/__tests__/route.test.ts` | 8 |

### Fase 4 — Componentes (`components/**/__tests__/`)
| Arquivo | Testes |
|---|---|
| `billing/__tests__/custom-amount-input.test.tsx` | 16 |
| `billing/__tests__/subscription-status-card.test.tsx` | 19 |
| `crm/__tests__/crm-filters.test.tsx` | 8 |
| `crm/__tests__/crm-conversation-card.test.tsx` | 8 |
| `livechat/__tests__/status-select.test.tsx` | 8 |

### Fase 5 — E2E (`e2e/`)
| Arquivo | Projeto | Testes |
|---|---|---|
| `global-setup.ts` | setup | autentica e salva sessão |
| `auth.spec.ts` | public | 7 |
| `livechat.spec.ts` | authenticated | 5 |
| `billing.spec.ts` | authenticated | 5 |
| `quick-replies.spec.ts` | authenticated | 3 |

---

## Setup E2E — pendente

### Bloqueador atual
O ambiente WSL2 precisa de libs do sistema para o Chromium headless (`libnspr4`, `libnss3`).

```bash
# Rodar com sudo no terminal Ubuntu
sudo $(which npx) playwright install-deps chromium
```

### Variáveis de ambiente (adicionar no `.env.local`)
```bash
E2E_USER_EMAIL=seu@email.com      # usuário com tenant_id associado no Supabase
E2E_USER_PASSWORD=suasenha
E2E_BASE_URL=http://localhost:3000
```

> O usuário de teste pode ser o seu próprio usuário de desenvolvimento.  
> O `.env.local` está no `.gitignore` — credenciais nunca vão ao repositório.

### Como funciona o `global-setup.ts`
1. Abre o Chrome headless
2. Navega para `/login`
3. Preenche as credenciais do `.env.local`
4. Aguarda redirect para `/livechat`
5. Salva os cookies de sessão em `e2e/.auth/user.json`
6. Todos os testes autenticados reutilizam esse estado — sem re-login

---

## Infraestrutura de mocks

### `lib/__tests__/mocks/supabase.ts`

Dois helpers reutilizáveis em todos os testes:

**`createQueryBuilder(result)`** — retorna um builder thenable que suporta encadeamento:
```typescript
// Suporta: await supabase.from('x').select().eq('id', '1')
// Suporta: await supabase.from('x').select().single()
const qb = createQueryBuilder({ data: { id: '1' }, error: null });
```

**`createServerSupabaseMock()`** — mock completo do cliente Supabase server:
```typescript
const mock = createServerSupabaseMock();
mockCreateClient.mockResolvedValue(mock);
```

> **Detalhe técnico importante:** o mock principal (objeto retornado por `createClient`) não tem método `then` para evitar o "thenable assimilation" do `Promise.resolve()`. Apenas o query builder retornado por `.from()` é thenable.

### Padrão de múltiplos `.from()` calls
Quando uma rota faz mais de uma query, use `mockReturnValueOnce` em sequência:
```typescript
mock.from
  .mockReturnValueOnce(createQueryBuilder({ data: userData }))    // 1ª query
  .mockReturnValueOnce(createQueryBuilder({ data: conversation })) // 2ª query
  .mockReturnValueOnce(createQueryBuilder({ data: null, error })); // 3ª query
```

---

## Padrões e convenções

### Estrutura de arquivos
```
lib/
├── validations/
│   └── __tests__/
├── queries/
│   └── __tests__/
└── __tests__/
    ├── setup.ts
    └── mocks/
        └── supabase.ts

app/api/[rota]/
└── __tests__/
    └── route.test.ts

components/[area]/
└── __tests__/
    └── Component.test.tsx

e2e/
├── global-setup.ts
├── auth.spec.ts
├── livechat.spec.ts
├── billing.spec.ts
└── quick-replies.spec.ts
```

### Checklist ao criar novo teste
- [ ] Arquivo em `__tests__/` ao lado do código testado
- [ ] Imports usando `@/` (path alias)
- [ ] `vi.clearAllMocks()` no `beforeEach`
- [ ] Testar caminho feliz + pelo menos 1 caso de erro
- [ ] Testar comportamento, não implementação

### Lições aprendidas
- **Radix UI Select** não funciona com `userEvent.click` no jsdom (falta `hasPointerCapture`) — mockar `@/components/ui/select` com `<select>` nativo
- **Zod v4** usa `message` em vez de `required_error` no `z.enum()`
- **`process.env` em módulo level** é capturado no load time — não muda com `beforeEach`; testar via `mock.calls` em vez de `expect.anything()`
- **Badge variant** não é diferenciável por classe CSS no jsdom — testar comportamento (clique), não estilo

---

## Próximos passos

- [ ] Finalizar setup E2E (instalar deps do sistema + configurar `.env.local`)
- [ ] Executar `npm run test:e2e:public` (não precisa de auth)
- [ ] Executar suite E2E completa e ajustar seletores se necessário
- [ ] Configurar CI (GitHub Actions) para rodar `npm test` em cada PR
- [ ] Aumentar cobertura gradualmente conforme novas features são adicionadas

---

## Referências

- Setup global: `lib/__tests__/setup.ts`
- Mock helpers: `lib/__tests__/mocks/supabase.ts`
- Config Vitest: `vitest.config.ts`
- Config Playwright: `playwright.config.ts`
- [Vitest docs](https://vitest.dev)
- [Testing Library docs](https://testing-library.com)
- [Playwright docs](https://playwright.dev)
