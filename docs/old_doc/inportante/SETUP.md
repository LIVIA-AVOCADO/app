# LIVIA MVP - Setup Completo

## ✅ O que foi configurado

### 1. Next.js 15 + TypeScript
- ✅ App Router habilitado
- ✅ TypeScript em modo **strict** com regras extras:
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
  - `noUncheckedIndexedAccess: true`
- ✅ Tailwind CSS v4 configurado
- ✅ Import alias `@/*` configurado

### 2. ESLint Rigoroso
- ✅ Regra **max-lines: 200** (warning)
- ✅ Proibido uso de `any` (error)
- ✅ Variáveis não utilizadas = error
- ✅ React Hooks exhaustive-deps = error
- ✅ Preferência por `const` e proibido `var`

### 3. Git Hooks (Husky + lint-staged)
- ✅ Pre-commit hook configurado
- ✅ Roda ESLint + TypeScript check automaticamente
- ✅ Previne commits com erros de tipo ou lint

### 4. Supabase
- ✅ Biblioteca `@supabase/supabase-js` instalada
- ✅ Biblioteca `@supabase/ssr` instalada
- ✅ Client para Client Components: `lib/supabase/client.ts`
- ✅ Server para Server Components: `lib/supabase/server.ts`
- ✅ Types placeholder em `types/database.ts`

### 5. n8n Integration
- ✅ Client base criado: `lib/n8n/client.ts`
- ✅ Função `callN8nWebhook` para uso em API Routes

### 6. shadcn/ui
- ✅ Biblioteca inicializada
- ✅ Componentes instalados:
  - Button, Input, Card
  - Avatar, Badge
  - Scroll Area, Separator, Textarea
- ✅ Utilitário `lib/utils.ts` criado

### 7. Estrutura de Pastas Modular
```
app/
├── api/
│   ├── n8n/          # API Routes para n8n webhooks
│   └── supabase/     # API Routes para Supabase (se necessário)
├── components/
│   ├── livechat/     # Componentes do Livechat
│   ├── knowledge-base/ # Componentes da Base de Conhecimento
│   ├── neurocore/    # Componentes do Treinamento Neurocore
│   ├── shared/       # Componentes compartilhados
│   └── ui/           # shadcn/ui components
├── lib/
│   ├── supabase/     # Supabase clients
│   ├── n8n/          # n8n utilities
│   ├── utils/        # Funções utilitárias
│   └── hooks/        # Custom React Hooks
└── types/
    └── database.ts   # Tipos do Supabase
```

### 8. Variáveis de Ambiente
- ✅ Template `.env.local.example` criado
- ⚠️ **Você precisa**: Criar `.env.local` com valores reais

---

## 🔧 Próximos Passos

### 1. Configurar Supabase
```bash
# Copie o template de variáveis
cp .env.local.example .env.local

# Edite .env.local e adicione:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

### 2. Rodar Migração no Supabase

⚠️ **IMPORTANTE**: Use a migração **IDEMPOTENTE**!

**Passo a passo:**
1. Acesse o Dashboard do Supabase → **SQL Editor**
2. **PRIMEIRO** (se tiver erros de constraint): Execute `/docs/migrations/000_cleanup_duplicates.sql`
3. **DEPOIS**: Execute `/docs/migrations/002_mvp_whatsapp_idempotent.sql`

**Por que 002 e não 001?**
- `001_schema_improvements.sql` - ❌ NÃO idempotente (causa erros ao rodar 2x)
- `002_mvp_whatsapp_idempotent.sql` - ✅ Idempotente (pode rodar múltiplas vezes)
- Foca em WhatsApp MVP (sem base vetorial no frontend)

### 3. Gerar Tipos TypeScript do Supabase
```bash
# Após rodar a migração
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

### 4. Configurar n8n
- Edite `.env.local` e adicione:
  - `N8N_BASE_URL`
  - `N8N_CALLBACK_SECRET`
  - Endpoints dos webhooks

### 5. Testar o Setup
```bash
# Rodar dev server
npm run dev

# Em outro terminal: verificar tipos
npm run type-check

# Verificar lint
npm run lint
```

---

## 📋 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build
npm run build        # Build de produção
npm start            # Roda build de produção

# Qualidade de código
npm run lint         # Roda ESLint
npm run type-check   # Verifica tipos TypeScript
```

---

## 🔒 Segurança

### Regras CRÍTICAS:
1. ❌ **NUNCA** exponha webhooks n8n no client
2. ✅ **SEMPRE** chame n8n via API Routes
3. ✅ **SEMPRE** valide `tenant_id` nas queries
4. ✅ Use RLS (Row Level Security) em todas as tabelas

### Exemplo de chamada n8n segura:
```typescript
// ❌ ERRADO: Client Component chamando n8n diretamente
const response = await fetch(process.env.N8N_BASE_URL + '/webhook/...');

// ✅ CERTO: Client chama API Route, API Route chama n8n
const response = await fetch('/api/n8n/send-message', { ... });
```

---

## 📚 Documentação

- **Schema do Banco**: [/docs/database-schema.md](../docs/database-schema.md)
- **Estados e Fluxos**: [/.claude/skills/livia-mvp/states-and-flows.md](../.claude/skills/livia-mvp/states-and-flows.md)
- **Webhooks n8n**: [/.claude/skills/livia-mvp/webhooks-livia.md](../.claude/skills/livia-mvp/webhooks-livia.md)
- **Migração SQL**: [/docs/migrations/001_schema_improvements_mvp_whatsapp.sql](../docs/migrations/001_schema_improvements_mvp_whatsapp.sql)

---

## 🐛 Troubleshooting

### Erro: "N8N_BASE_URL not configured"
- Verifique se `.env.local` existe e tem a variável `N8N_BASE_URL`

### Erro de tipos no Supabase
- Execute: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts`

### Pre-commit hook falhou
- Corrija os erros de ESLint ou TypeScript reportados
- Use `git commit --no-verify` apenas em emergências (não recomendado)

---

## 🎯 Próxima Feature: Livechat

Quando estiver pronto para começar a desenvolver o Livechat:
1. Certifique-se de que a migração foi rodada
2. Tipos do Supabase foram gerados
3. Variáveis de ambiente estão configuradas
4. Leia a documentação de estados e fluxos
5. Comece pelos componentes de layout (ContactList, ConversationView, MessageInput)
