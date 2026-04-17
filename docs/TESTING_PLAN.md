# Plano de Cobertura de Testes — LIVIA MVP

> **Status:** ✅ Fases 1-5 concluídas  
> **Criado em:** 2026-04-17  
> **Objetivo:** Sanar o débito técnico de testes automatizados de forma incremental e sustentável

---

## Contexto e Estado Atual

### Infraestrutura disponível (já instalada)
| Ferramenta | Versão | Uso |
|---|---|---|
| `vitest` | ^4.0.13 | Runner principal de testes unitários/integração |
| `@testing-library/react` | ^16.3.0 | Testes de componentes React |
| `@testing-library/user-event` | ^14.6.1 | Simulação de eventos do usuário |
| `@testing-library/jest-dom` | ^6.9.1 | Matchers DOM adicionais |
| `@vitest/coverage-v8` | ^4.0.13 | Relatórios de cobertura |
| `jsdom` | ^27.2.0 | Ambiente DOM para testes |

### O que NÃO existe ainda
- Testes de integração de API routes
- Testes de componentes React
- Testes E2E (Playwright não instalado)
- Mock Service Worker (MSW) para interceptar requests

### Único arquivo de teste existente
`lib/repositories/__tests__/ConversationRepository.test.ts` — serve como referência de padrão.

---

## Princípios do Plano

1. **Incremental:** Nenhum sprint dedicado exclusivamente a testes — testes são escritos junto com o código novo ou ao tocar código existente.
2. **Boy Scout Rule:** Sempre que tocar um arquivo, deixar pelo menos 1 teste novo.
3. **Risco primeiro:** Priorizar código financeiro, autenticação e core do produto.
4. **Sem over-engineering:** Testar comportamento, não implementação.

---

## Matriz de Prioridade

| Prioridade | Área | Motivo | Tipo de Teste |
|---|---|---|---|
| 🔴 Crítico | `lib/validations/` | Base de todas as APIs | Unitário |
| 🔴 Crítico | `app/api/stripe/` | Código financeiro | Integração |
| 🔴 Crítico | `app/api/billing/` | Código financeiro | Integração |
| 🔴 Crítico | `app/api/mercadopago/` | Código financeiro | Integração |
| 🟠 Alto | `lib/queries/` | Queries Supabase críticas | Unitário |
| 🟠 Alto | `app/api/conversations/` | Core do produto | Integração |
| 🟠 Alto | `app/api/livechat/` | Core do produto | Integração |
| 🟡 Médio | `app/api/contacts/` | Funcionalidade importante | Integração |
| 🟡 Médio | `app/api/quick-replies/` | Referência de padrão | Integração |
| 🟡 Médio | `app/api/auth/` | Segurança | Integração |
| 🟢 Baixo | Componentes React | UI crítica | Componente |
| 🟢 Baixo | Fluxos E2E | Smoke tests | E2E |

---

## Fase 1 — Validações Zod (Fundação)

**Meta:** 100% de cobertura em `lib/validations/`  
**Esforço estimado:** 1 semana  
**Por quê começar aqui:** São funções puras, sem dependências externas. Cobrir validações = cobrir indiretamente todas as APIs que as usam.

### Arquivos alvo

| Arquivo | Schemas a testar |
|---|---|
| `lib/validations/stripe-validation.ts` | checkout, custom_payment, subscription |
| `lib/validations/onboarding-validation.ts` | createSession, saveStep, company, agent, knowledge, tags |
| `lib/validations/reactivationValidation.ts` | settings, steps, formulário completo |
| `lib/validations/agent-schedule-validation.ts` | intervalos semanais, exceções, horários |
| `lib/validations/tag-validation.ts` | criação, atualização, validações customizadas |
| `lib/validations/conversation-timeout-validation.ts` | timeout, campos obrigatórios |
| `lib/validations/agentPromptValidation.ts` | persona, objetivo, comunicação, limitações |

### Padrão de teste para validações Zod

```typescript
// lib/validations/__tests__/stripe-validation.test.ts
import { describe, it, expect } from 'vitest';
import { checkoutSchema } from '../stripe-validation';

describe('checkoutSchema', () => {
  it('aceita dados válidos', () => {
    const result = checkoutSchema.safeParse({ plan: 'pro', interval: 'monthly' });
    expect(result.success).toBe(true);
  });

  it('rejeita campos obrigatórios ausentes', () => {
    const result = checkoutSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('plan');
  });

  it('rejeita valores fora do enum', () => {
    const result = checkoutSchema.safeParse({ plan: 'invalido' });
    expect(result.success).toBe(false);
  });
});
```

### Estrutura de arquivos

```
lib/validations/
├── stripe-validation.ts
├── onboarding-validation.ts
├── ...
└── __tests__/
    ├── stripe-validation.test.ts
    ├── onboarding-validation.test.ts
    ├── reactivation-validation.test.ts
    ├── agent-schedule-validation.test.ts
    ├── tag-validation.test.ts
    ├── conversation-timeout-validation.test.ts
    └── agent-prompt-validation.test.ts
```

---

## Fase 2 — Queries Supabase

**Meta:** Cobrir queries críticas em `lib/queries/`  
**Esforço estimado:** 2 semanas  
**Referência:** `lib/repositories/__tests__/ConversationRepository.test.ts`

### Arquivos alvo (por prioridade)

| Arquivo | Prioridade |
|---|---|
| `lib/queries/billing.ts` | 🔴 Crítico |
| `lib/queries/stripe.ts` | 🔴 Crítico |
| `lib/queries/livechat.ts` | 🟠 Alto |
| `lib/queries/contacts.ts` | 🟠 Alto |
| `lib/queries/agents.ts` | 🟡 Médio |
| `lib/queries/tags-crud.ts` | 🟡 Médio |
| `lib/queries/quick-replies.ts` | 🟡 Médio |

### Padrão de mock do Supabase

```typescript
// lib/__tests__/mocks/supabase.ts — helper reutilizável
import { vi } from 'vitest';

export function createSupabaseMock(overrides = {}) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    ...overrides,
  };
}
```

---

## Fase 3 — API Routes Críticas

**Meta:** Cobrir as rotas de maior risco de regressão  
**Esforço estimado:** 3 semanas  
**Ferramenta adicional necessária:** `msw` (Mock Service Worker) para mockar chamadas externas (Stripe, MercadoPago, n8n)

### Instalação do MSW

```bash
npm install -D msw
```

### Rotas alvo (por prioridade)

#### Billing e Pagamentos 🔴
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/stripe/subscription/route.ts`
- `app/api/stripe/switch-to-pix/route.ts`
- `app/api/billing/wallet/route.ts`
- `app/api/billing/auto-recharge/route.ts`
- `app/api/mercadopago/pix/create/route.ts`
- `app/api/mercadopago/webhook/route.ts`

#### Core do Produto 🟠
- `app/api/livechat/messages/route.ts`
- `app/api/conversations/update-status/route.ts`
- `app/api/conversations/pause-ia/route.ts`
- `app/api/conversations/resume-ia/route.ts`
- `app/api/n8n/send-message/route.ts`

#### Auth e Segurança 🟠
- `app/api/auth/signup/route.ts`

### Padrão de teste para API routes

```typescript
// app/api/quick-replies/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock de auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  })),
}));

describe('GET /api/quick-replies', () => {
  it('retorna 401 sem autenticação', async () => {
    // arrange: mockar getUser retornando null
    const req = new NextRequest('http://localhost/api/quick-replies');
    const res = await GET(req);
    // assert
    expect(res.status).toBe(401);
  });

  it('retorna lista de quick replies do tenant', async () => {
    const req = new NextRequest('http://localhost/api/quick-replies');
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
```

---

## Fase 4 — Componentes React

**Meta:** Cobrir componentes críticos da UI  
**Esforço estimado:** 2-3 semanas (após Fase 3)

### Prioridades

| Componente | Motivo |
|---|---|
| Componentes do Livechat | Core do produto |
| Formulários de billing | Risco financeiro |
| Componentes de auth (login/signup) | Segurança |

### Padrão de teste de componente

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickReplyButton } from '../QuickReplyButton';

describe('QuickReplyButton', () => {
  it('renderiza o texto da quick reply', () => {
    render(<QuickReplyButton text="Olá!" onSelect={vi.fn()} />);
    expect(screen.getByText('Olá!')).toBeInTheDocument();
  });

  it('chama onSelect ao clicar', async () => {
    const onSelect = vi.fn();
    render(<QuickReplyButton text="Olá!" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('Olá!');
  });
});
```

---

## Fase 5 — E2E com Playwright ✅

**Status:** Infraestrutura criada e 21 testes escritos  
**Arquivos criados:**

```
playwright.config.ts
e2e/
├── global-setup.ts        ← autentica uma vez e salva sessão
├── auth.spec.ts           ← login form, redirects (7 testes, projeto "public")
├── livechat.spec.ts       ← livechat autenticado (5 testes)
├── billing.spec.ts        ← financeiro/saldo (5 testes)
└── quick-replies.spec.ts  ← API quick replies (3 testes)
```

### Setup para execução

**1. Instalar dependências do sistema (necessário uma vez):**
```bash
sudo npx playwright install-deps chromium
```

**2. Configurar variáveis de ambiente para testes autenticados:**
```bash
# .env.local ou variáveis de CI
E2E_USER_EMAIL=seu@email.com
E2E_USER_PASSWORD=suasenha
```

**3. Executar:**
```bash
npm run test:e2e             # todos os testes
npm run test:e2e:public      # só testes sem auth (login, redirects)
npm run test:e2e:auth        # só testes autenticados
npm run test:e2e:ui          # interface visual do Playwright
```

### Estratégia de autenticação

O `global-setup.ts` faz login uma vez e salva a sessão em `e2e/.auth/user.json`.
Todos os testes do projeto "authenticated" reutilizam esse estado — sem re-login entre testes.

### Fluxos cobertos

| Spec | Projeto | Fluxo |
|---|---|---|
| `auth.spec.ts` | public | Formulário de login, erros, redirects para unauthenticated |
| `livechat.spec.ts` | authenticated | Página carrega, lista de conversas, filtros |
| `billing.spec.ts` | authenticated | Página de saldo, card de assinatura, API wallet |
| `quick-replies.spec.ts` | authenticated | API CRUD, validações |

---

## Configuração de Coverage

Adicionar ao `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./lib/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'lib/validations/**',
        'lib/queries/**',
        'lib/repositories/**',
        'app/api/**',
        'components/**',
      ],
      exclude: [
        'node_modules/**',
        '**/__tests__/**',
        '**/types/**',
      ],
      thresholds: {
        // Aumentar gradualmente conforme cobertura sobe
        lines: 20,      // Fase 1: 20% → Meta final: 70%
        functions: 20,
        branches: 15,
      },
    },
  },
});
```

### Comandos disponíveis

```bash
npm test                  # Rodar todos os testes
npm run test:watch        # Modo watch (desenvolvimento)
npm run test:coverage     # Gerar relatório de cobertura
npm run test:ui           # Interface visual do Vitest
npx playwright test       # Rodar testes E2E (após instalar)
```

---

## Roadmap e Metas de Coverage

| Fase | Prazo | Coverage alvo | Entregável |
|---|---|---|---|
| Fase 1 — Validações | Semana 1-2 | ~20% | 7 arquivos de teste |
| Fase 2 — Queries | Semana 3-4 | ~35% | 7+ arquivos de teste |
| Fase 3 — API Routes | Semana 5-7 | ~50% | 15+ arquivos de teste |
| Fase 4 — Componentes | Semana 8-9 | ~60% | 10+ arquivos de teste |
| Fase 5 — E2E | Semana 10 | — | 4 specs E2E |

---

## Convenções e Localização dos Testes

```
lib/
├── validations/
│   └── __tests__/          ← testes de validações Zod
├── queries/
│   └── __tests__/          ← testes de queries Supabase
├── repositories/
│   └── __tests__/          ← já existe (referência)
└── __tests__/
    ├── setup.ts             ← setup global
    ├── fixtures/            ← dados de teste reutilizáveis
    └── mocks/               ← helpers de mock (Supabase, Stripe, etc.)

app/api/
└── [rota]/
    └── __tests__/
        └── route.test.ts   ← teste da API route

components/
└── [area]/
    └── __tests__/
        └── ComponentName.test.tsx

e2e/                        ← testes Playwright (a criar)
```

---

## Checklist para Novos Testes

Ao criar um arquivo de teste, verificar:

- [ ] O arquivo está no `__tests__/` correto ao lado do código testado
- [ ] Os imports usam `@/` (path alias configurado)
- [ ] Mocks são limpos no `beforeEach` com `vi.clearAllMocks()`
- [ ] Testar o caminho feliz + pelo menos 1 caso de erro
- [ ] Não testar detalhes de implementação — testar comportamento
- [ ] Dados de teste reutilizáveis ficam em `lib/__tests__/fixtures/`

---

## Referências

- Arquivo de teste de referência: `lib/repositories/__tests__/ConversationRepository.test.ts`
- Setup global de testes: `lib/__tests__/setup.ts`
- Configuração Vitest: `vitest.config.ts`
- [Vitest docs](https://vitest.dev)
- [Testing Library docs](https://testing-library.com)
- [Playwright docs](https://playwright.dev)
