# Variáveis de Ambiente — LIVIA

**Última atualização:** 2026-04-22

---

## Next.js (Vercel + local)

Referência completa: `.env.local.example`

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase > Settings > API > anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase > Settings > API > service_role |
| `N8N_BASE_URL` | ✅ | URL da instância n8n (ex: `https://livia-wh.online24por7.ai`) |
| `N8N_SEND_MESSAGE_WEBHOOK` | ✅ | Path do webhook de envio de mensagem |
| `N8N_SYNC_SYNAPSE_WEBHOOK` | ✅ | Path do webhook de sync do Synapse |
| `N8N_DELETE_SYNAPSE_EMBEDDINGS_WEBHOOK` | ✅ | Path do webhook de delete de embeddings |
| `N8N_TOGGLE_SYNAPSE_EMBEDDINGS_WEBHOOK` | ✅ | Path do webhook de toggle embeddings |
| `N8N_INACTIVATE_BASE_WEBHOOK` | ✅ | Path do webhook de inativar base |
| `N8N_PAUSE_CONVERSATION_WEBHOOK` | ✅ | Path do webhook de pausar conversa |
| `N8N_RESUME_CONVERSATION_WEBHOOK` | ✅ | Path do webhook de retomar conversa |
| `N8N_PAUSE_IA_WEBHOOK` | ✅ | Path do webhook de pausar IA |
| `N8N_RESUME_IA_WEBHOOK` | ✅ | Path do webhook de retomar IA |
| `N8N_NEUROCORE_QUERY_WEBHOOK` | ✅ | Path do webhook de query na base de conhecimento |
| `STRIPE_SECRET_KEY` | ✅ | Stripe > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe > Developers > Webhooks > endpoint secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe > Developers > API Keys |
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ | MP > Suas integrações > Credenciais de produção |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | ✅ | MP > Suas integrações > Credenciais de produção |
| `MERCADOPAGO_WEBHOOK_SECRET` | ✅ | MP > Notificações IPN > chave secreta |
| `N8N_MOCK` | ⚠️ dev | `true` em dev local, `false` em produção |
| `NEUROCORE_MOCK` | ⚠️ dev | `true` em dev local, `false` em produção |
| `CRON_SECRET` | ✅ prod | String segura aleatória — autentica o job n8n `metrics_daily` |

> **Como configurar na Vercel:** Dashboard > Project > Settings > Environment Variables

---

## Ambientes — Produção vs Staging

| Variável | Produção (`main`) | Staging (`staging` branch) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wfrxwfbslhkkzkexyilx.supabase.co` | `https://qejxaqqfdpmzahlrshws.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role | staging service role |
| `CRON_SECRET` | string segura (prod) | qualquer string (staging) |
| Demais variáveis | valores reais | pode apontar para mesmos webhooks n8n |

> **Onde obter as chaves do staging:**
> Supabase → selecionar projeto `qejxaqqfdpmzahlrshws` → Settings → API

### Como configurar no Vercel (branch-specific env vars)

1. Vercel Dashboard → seu projeto → **Settings → Environment Variables**
2. Para cada variável que difere entre prod e staging:
   - Clique na variável existente (ou adicione nova)
   - Em "Environments": desmarque **Production**, marque **Preview**
   - Em "Git Branch": preencha `staging`
   - Salve com o valor do projeto Supabase staging
3. As variáveis sem branch específica continuam valendo para todos os previews

> **Resultado:** push para `staging` → Vercel cria preview com banco de staging.
> Push para `main` → deploy de produção com banco de produção. Zero risco de cruzamento.

---

## livia-gateway (VPS — stack yaml)

Variáveis configuradas em `/root/stacks/livia-gateway.yaml` na VPS.

| Variável | Valor atual | Descrição |
|---|---|---|
| `PORT` | `8080` | Porta de escuta do servidor HTTP |
| `LOG_LEVEL` | `info` | Nível de log: `debug`, `info`, `warn`, `error` |
| `SHADOW_MODE` | `true` | `true` = apenas loga, não age. `false` = processa mensagens |
| `N8N_WEBHOOK_URL` | `https://livia-wh.online24por7.ai/webhook/dev_first_integrator_001_dev` | URL completa do n8n que recebe as mensagens da Evolution |

> **Para Passo 2 (gateway persiste direto):** adicionar variáveis do Supabase e Evolution.
> Ver Seção 6.7 do `PLATFORM_EVOLUTION_PLAN.md` para lista completa.

---

## Evolution API v2 (VPS — stack yaml)

Variáveis configuradas em `/root/stacks/evolution_v2.yaml` na VPS.

| Variável | Valor | Descrição |
|---|---|---|
| `SERVER_URL` | `https://livia.wsapi.online24por7.ai` | URL pública da Evolution |
| `AUTHENTICATION_API_KEY` | `29eb9af8-...` | API key para autenticar chamadas REST |
| `DATABASE_CONNECTION_URI` | `postgresql://evolution_user:...@postgres:5432/evolution` | Conexão com Postgres |
| `CACHE_REDIS_URI` | `redis://redis:6379/1` | Conexão com Redis (database 1) |
| `RABBITMQ_URI` | `amqp://frank:...@rabbitmq:5672/default` | Conexão com RabbitMQ |
| `SHADOW_MODE` | — | Não existe na Evolution — controle é no livia-gateway |

---

## n8n — Livia (VPS — stack yaml)

| Variável | Descrição |
|---|---|
| `N8N_ENCRYPTION_KEY` | Chave de criptografia das credenciais armazenadas no n8n |
| `N8N_RUNNERS_AUTH_TOKEN` | Token de autenticação dos task runners |
| `DB_POSTGRESDB_PASSWORD` | Senha do banco `n8n_livia` |
| `WEBHOOK_URL` | URL pública para webhooks: `https://livia-wh.online24por7.ai/` |
| `N8N_EDITOR_BASE_URL` | URL pública do editor: `https://livia-edit.online24por7.ai/` |

---

## Checklist de setup para novo ambiente

```
[ ] Copiar .env.local.example → .env.local
[ ] Preencher NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
[ ] Preencher SUPABASE_SERVICE_ROLE_KEY
[ ] Definir N8N_MOCK=true (dev) ou configurar N8N_BASE_URL real
[ ] Configurar Stripe (opcional em dev — feature de pagamento)
[ ] Configurar Mercado Pago (opcional em dev — feature de pagamento)
[ ] npm install
[ ] npm run dev
```
