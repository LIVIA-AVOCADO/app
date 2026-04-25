# LIVIA — 12-Factor App: Diagnóstico e Plano de Ação
# Infraestrutura Escalável e Resiliente

**Data:** 2026-04-22  
**Status:** Diagnóstico concluído — execução pendente por fases  
**Autores:** Frank Marcelino + Claude  
**Referência:** [PLATFORM_EVOLUTION_PLAN.md](./PLATFORM_EVOLUTION_PLAN.md)

---

## Visão Geral

Este documento mapeia o estado atual da plataforma LIVIA contra os
[12 fatores para aplicações web escaláveis](https://12factor.net) e define
um plano de ação ordenado por **impacto × esforço**.

### Legenda de status

| Símbolo | Significado |
|---|---|
| ✅ | Conforme — nenhuma ação necessária |
| ⚠️ | Parcial — melhoria desejável |
| ❌ | Crítico — risco operacional ou de segurança |

---

## Diagnóstico por Fator

### I. Codebase — ⚠️ Parcial

> Um repositório por app, múltiplos ambientes a partir do mesmo código.

| Item | Status | Detalhe |
|---|---|---|
| `livia_dev_01` no GitHub | ✅ | Repositório único, deploy via Vercel |
| `livia-gateway` no GitHub | ✅ | Repositório separado, correto |
| Infra (stacks yaml) no GitHub | ✅ | `Setup-Base-Docker-Swarm-Traefik-Portainer-Ctop` |
| Token PAT embutido no git remote | ❌ | `ghp_...` visível em `git remote -v` — vazamento = acesso total ao repo |
| CI/CD | ❌ | Sem `.github/workflows` — build e deploy manuais |
| Branch de staging | ❌ | `main` → produção diretamente, sem ambiente intermediário |

**Ações necessárias:**
- [ ] Remover PAT do git remote — usar SSH ou credential manager
- [ ] Criar `.github/workflows/ci.yml` — lint + type-check + build em cada PR
- [ ] Criar branch `staging` com Vercel preview deployment

---

### II. Dependencies — ⚠️ Parcial

> Declare e isole todas as dependências explicitamente.

| Item | Status | Detalhe |
|---|---|---|
| Next.js: `package.json` + `package-lock.json` | ✅ | Dependências declaradas e travadas |
| Go gateway: `go.mod` + `go.sum` | ✅ | Módulos versionados |
| n8n, Evolution: imagens com versão fixa | ✅ | `2.3.2`, `v2.3.6` nos stack yamls |
| `livia-gateway:latest` no stack | ❌ | Sem versão — rollback impossível se imagem for sobrescrita |
| `.env.local.example` deletado | ❌ | `D .env.local.example` no git status — novos devs sem referência |

**Ações necessárias:**
- [ ] Restaurar `.env.local.example` com todas as variáveis (valores fictícios)
- [ ] Tagear imagens do gateway com versão semântica: `livia-gateway:1.0.0`
- [ ] Stack yaml: usar tag fixa `livia-gateway:1.x.x` em vez de `latest`

---

### III. Config — ❌ Crítico

> Tudo que varia entre ambientes vai em variáveis de ambiente. Nada no código.

| Item | Status | Detalhe |
|---|---|---|
| Next.js usa `.env.local` (não commitado) | ✅ | Correto — `.gitignore` protege |
| Credenciais hardcoded nos stack yamls | ❌ | Senhas, API keys e tokens diretamente nos arquivos |
| Token PAT no git remote | ❌ | `https://ghp_...@github.com` exposto localmente |
| Vercel env vars: sem documentação | ⚠️ | Sem registro do que está configurado em produção |
| Sem suporte a múltiplos ambientes | ❌ | Sem distinção de config entre dev, staging e prod |

**Ações necessárias:**
- [ ] Remover PAT do remote: `git remote set-url origin git@github.com:FrankMarcelino/livia_dev_01.git`
- [ ] Stack yamls: mover credenciais para Docker Secrets ou `.env` no servidor (não no repositório)
- [ ] Criar `docs/ENV_VARS.md` documentando todas as variáveis necessárias por serviço
- [ ] Auditar Vercel env vars e documentar em `docs/ENV_VARS.md`
- [ ] Restaurar `.env.local.example` com todas as chaves, valores fictícios e comentários

---

### IV. Backing Services — ✅ Bom

> Bancos, filas, caches são recursos anexados via URL. Troca sem mudança de código.

| Item | Status | Detalhe |
|---|---|---|
| Supabase referenciado via URL/key | ✅ | Substituível sem mudar código |
| n8n como backing service do Next.js | ✅ | Chamado via webhook URL configurável |
| Postgres/Redis/RabbitMQ via URI | ✅ | Conexão por string de ambiente |
| Evolution como backing service | ✅ | Acessado via API REST com API key |
| livia-gateway → n8n via env var | ✅ | `N8N_WEBHOOK_URL` configurável sem rebuild |

**Nenhuma ação crítica. Manter padrão atual.**

---

### V. Build, Release, Run — ❌ Crítico

> Separe estritamente as três etapas. Artefatos de release são imutáveis.

| Item | Status | Detalhe |
|---|---|---|
| Vercel: build + release + run separados | ✅ | Pipeline automático no push |
| `main` → produção sem gate de qualidade | ❌ | Qualquer commit afeta usuários reais (D-001) |
| livia-gateway: `docker build` na VPS de produção | ❌ | Build acontece no mesmo servidor que roda a app |
| Sem artefatos versionados | ❌ | Não existe imagem anterior tagueada para rollback |
| Rollback do gateway | ❌ | Requer rebuild manual — não há versão anterior disponível |

**Ações necessárias:**
- [ ] GitHub Actions: build da imagem Go → push para GitHub Container Registry (ghcr.io)
- [ ] Stack yaml: referenciar `ghcr.io/frankmarcelino/livia-gateway:v1.x.x`
- [ ] Criar processo de release: tag git → build CI → push imagem → atualizar stack
- [ ] VPS: remover `docker build` do fluxo de deploy — apenas `docker service update --image`
- [ ] Vercel: configurar branch protection em `main` (require PR + CI pass)

---

### VI. Processes — ⚠️ Parcial

> Processos stateless. Estado persistente exclusivamente nos backing services.

| Item | Status | Detalhe |
|---|---|---|
| Next.js: stateless (Vercel) | ✅ | Sem estado local entre requests |
| livia-gateway: stateless | ✅ | Dedup LRU em memória (ephemeral — correto) |
| n8n: modo queue (editor/worker/webhook separados) | ✅ | Estado no Postgres |
| Evolution: sessões WhatsApp no volume | ⚠️ | Estado persistente em disco — restart pode desconectar sessão WA |
| Sem shared filesystem entre réplicas | ✅ | Cada serviço tem volume próprio |

**Ações necessárias:**
- [ ] Evolution: documentar procedimento de reconexão após restart
- [ ] Evolution: avaliar backup automático do volume `evolution_v2_data` (sessões WA)

---

### VII. Port Binding — ✅ Bom

> A app expõe serviços via porta. Não depende de servidor web externo.

| Item | Status | Detalhe |
|---|---|---|
| Todos os serviços exportam porta própria | ✅ | Traefik faz roteamento externo |
| Next.js: self-contained no Vercel | ✅ | Sem dependência de servidor externo |
| livia-gateway: `PORT` via env var | ✅ | Binding explícito e configurável |
| Traefik como proxy reverso | ✅ | Camada de roteamento independente dos serviços |

**Nenhuma ação crítica. Manter padrão atual.**

---

### VIII. Concurrency — ❌ Crítico

> Escale horizontalmente com processos. Processos são cidadãos de primeira classe.

| Item | Status | Detalhe |
|---|---|---|
| n8n: editor + webhook + worker separados | ✅ | Escala horizontal possível por tipo |
| Todos os serviços com `replicas: 1` | ❌ | Sem redundância, zero tolerância a falha |
| Docker Swarm: single node (`manager01`) | ❌ | Um servidor cai → tudo para |
| `constraints: node.role == manager` em tudo | ❌ | Impede adicionar worker nodes |
| livia-gateway: `replicas: 1` | ❌ | Ponto único de falha no caminho de mensagens |

**Ações necessárias (quando carga justificar):**
- [ ] Adicionar worker node ao Swarm (segunda VPS Hostinger)
- [ ] Mudar placement para `node.labels.app == livia` (não restrito a manager)
- [ ] livia-gateway: aumentar para `replicas: 2` com sessão sticky no Traefik
- [ ] n8n webhook: escalar para `replicas: 2` para alta disponibilidade
- [ ] Documentar critério de escala (ex: latência p95 > 500ms ou CPU > 70%)

---

### IX. Disposability — ⚠️ Parcial

> Suba rápido, encerre graciosamente. Suporte a falha abrupta.

| Item | Status | Detalhe |
|---|---|---|
| Docker Swarm reinicia containers com falha | ✅ | Restart automático padrão |
| `update_config: order: start-first` | ✅ | Zero downtime no deploy |
| `failure_action: rollback` | ✅ | Reverte automaticamente se falhar |
| Health check no livia-gateway | ❌ | Swarm detecta processo vivo mas não sabe se a app responde |
| Evolution: graceful shutdown de sessões WA | ⚠️ | Kill abrupto pode deixar sessão em estado inconsistente |
| Sem `HEALTHCHECK` nos Dockerfiles | ❌ | Containers marcados como healthy mesmo com app travada |

**Ações necessárias:**
- [ ] livia-gateway: adicionar `HEALTHCHECK` no Dockerfile (`GET /health`)
- [ ] Stack yamls: adicionar `healthcheck` em todos os serviços críticos
- [ ] Evolution: testar comportamento de reconexão após restart e documentar
- [ ] livia-gateway: implementar graceful shutdown (`SIGTERM` → drena requests → encerra)

---

### X. Dev/Prod Parity — ❌ Crítico

> Minimize diferença entre desenvolvimento e produção.

| Item | Status | Detalhe |
|---|---|---|
| Next.js dev vs Vercel prod | ⚠️ | Diferenças de Edge runtime podem mascarar bugs |
| Sem ambiente de staging | ❌ | Código vai de `localhost` direto para produção |
| n8n: desenvolvimento = produção | ❌ | Mesma VPS para testar e executar workflows reais |
| Supabase: sem projeto de staging | ❌ | Dev e prod usam o mesmo banco (ou não documentado) |
| livia-gateway: testado localmente vs. VPS | ⚠️ | Sem ambiente intermediário validado |

**Ações necessárias:**
- [ ] Criar projeto Supabase separado para staging/desenvolvimento
- [ ] Vercel: configurar branch `staging` com env vars de staging
- [ ] n8n: criar instância separada para desenvolvimento de workflows (ou usar mock)
- [ ] livia-gateway: `docker-compose.yml` local para desenvolvimento completo
- [ ] Documentar em `SETUP.md` como subir ambiente local completo

---

### XI. Logs — ❌ Crítico

> A app escreve em stdout. O ambiente coleta, retém e rotaciona.

| Item | Status | Detalhe |
|---|---|---|
| livia-gateway: JSON estruturado em stdout | ✅ | Bem implementado |
| n8n: logs em stdout | ✅ | Coletados pelo Docker |
| Sem agregação centralizada | ❌ | Logs vivem no node — se a VPS cair, logs somem |
| Sem rotação configurada no Docker | ❌ | `docker logs` sem limite → disco cheio com o tempo |
| Sem alertas de falha | ❌ | Serviço cai silenciosamente — ninguém é notificado |
| Vercel logs: efêmeros | ⚠️ | Logs de produção do Next.js somem após horas |

**Ações necessárias:**
- [ ] Docker daemon: configurar `log-driver` com rotação (`json-file`, `max-size: 50m`, `max-file: 3`)
- [ ] Uptime Kuma ou similar: monitoramento de endpoints (`/health`, Supabase, n8n)
- [ ] Alerta por e-mail/Telegram quando serviço cai
- [ ] (Futuro) Stack de observabilidade: Loki + Grafana ou Seq para log aggregation
- [ ] Vercel: configurar integração de logs externos (Datadog, Axiom, ou Logtail)

---

### XII. Admin Processes — ❌ Crítico

> Tarefas administrativas rodam como processos one-off no mesmo ambiente da app.

| Item | Status | Detalhe |
|---|---|---|
| Supabase migrations: manuais via UI | ❌ | Sem pipeline, sem versionamento de schema |
| n8n workflows: gerenciados via UI | ❌ | Sem backup automático, sem versionamento |
| Infra: sem script de setup reproduzível | ❌ | Recriar do zero seria trabalho manual extenso |
| livia-gateway: build manual na VPS | ❌ | Processo de release não documentado |
| Sem backup automatizado dos volumes | ❌ | Perda de dados sem aviso se VPS falhar |

**Ações necessárias:**
- [ ] Supabase: usar `supabase db push` + migrations em `supabase/migrations/` versionadas no git
- [ ] n8n: script de export de workflows para JSON versionado no git (backup semanal)
- [ ] VPS: script `setup.sh` reproduzível para recriar toda a infra do zero
- [ ] Backup automatizado: `restic` ou similar para volumes críticos (postgres, evolution sessions, n8n)
- [ ] Documentar runbook de disaster recovery em `docs/RUNBOOK.md`

---

## Plano de Ação — Ordenado por Impacto × Esforço

### Prioridade 1 — Segurança Imediata ✅ Concluída em 2026-04-22

Ações que eliminam risco de segurança com esforço mínimo.

```
[x] 1.1 — Remover PAT e configurar SSH no git remote                   ← 2026-04-23
    Chave id_livia_github (ED25519) gerada e adicionada ao GitHub (FrankMarcelino)
    git remote set-url origin git@github.com:FrankMarcelino/livia_dev_01.git
    ~/.ssh/config: Host github.com com IdentityFile ~/.ssh/id_livia_github
    Impacto: elimina vazamento de credencial + push sem senha  |  Esforço: 5 min

[x] 1.2 — Restaurar .env.local.example                                ← 2026-04-22
    Recriado com 21 variáveis, valores fictícios e comentários de origem
    Impacto: previne perda de referência  |  Esforço: 15 min

[x] 1.3 — Documentar variáveis de ambiente                            ← 2026-04-22
    docs/ENV_VARS.md: mapa completo Next.js + gateway + Evolution + n8n
    Impacto: base para staging e onboarding  |  Esforço: 30 min
```

---

### Prioridade 2 — Observabilidade Básica (esta semana)

Sem logs e alertas, problemas em produção ficam invisíveis.

```
[x] 2.1 — Rotação de logs no Docker daemon                            ← já configurado
    /etc/docker/daemon.json: max-size 10m, max-file 3 (10% disco, 86GB livres)
    Impacto: previne disco cheio  |  Esforço: 10 min

[x] 2.2 — Uptime Kuma na VPS                                          ← 2026-04-23
    Stack deployada: https://monitor.online24por7.ai (DNS: monitor CNAME → manager01)
    Monitores configurados: livia-gateway /health, Evolution, n8n livia+sofhia editor+webhook, Supabase (TCP 443)
    Lição: criar DNS ANTES de deployar stack — Traefik tenta ACME imediatamente
    Impacto: falhas notificadas em < 1 min  |  Esforço: 1h

[x] 2.3 — Health checks nos serviços críticos                         ← 2026-04-23
    Dockerfile livia-gateway: HEALTHCHECK wget /health (30s interval, start 10s)
    livia-gateway stack: healthcheck ativo — container reporta (healthy)
    livia + sofhia webhook: healthcheck /healthz adicionado nos stacks
    app/api/health/route.ts: GET /api/health — verifica Supabase, retorna latência
      Monitor Uptime Kuma: https://livia.app.online24por7.ai/api/health
      Retorna 200 {"status":"ok","latency_ms":N} ou 503 se Supabase inacessível
    Impacto: Swarm detecta app travada, não só processo morto  |  Esforço: 2h
```

---

### Prioridade 3 — Correção da Evolution ✅ Concluída em 2026-04-22

Desbloqueio direto do Fase 2 Passo 1 do PLATFORM_EVOLUTION_PLAN.

```
[x] 3.1 — Fix banco da Evolution                                      ← 2026-04-22
    Criado evolution_user:BTudZJDU09M3 no livia_postgres
    Stack yaml /root/stacks/evolution_v2.yaml criado com URI correta
    Redeploy: Evolution respondendo 200, fetchInstances funcional

[x] 3.2 — Instância livia-test criada com webhook → livia-gateway      ← 2026-04-22
    POST /instance/create com webhook: https://livia-gw.online24por7.ai/webhook/evolution
    Confirmado nos logs: event=connection.update, n8n_forward_ok=true
    Shadow mode ativo: gateway loga + faz forward para n8n

[x] 3.3 — Salvar stack yaml no repositório de infra                    ← 2026-04-23
    Todos os 4 stacks sanitizados (SEU_* placeholders) no repo Setup-Base-Docker-Swarm
    evolution_v2.yaml + livia-gateway.yaml adicionados; livia.yaml + sofhia.yaml corrigidos
    README reescrito sem credenciais expostas
    Impacto: infra reproduzível  |  Esforço: 15 min

[x] 3.4 — Validar logs por 24h (critério de sucesso do Passo 1)    ← 2026-04-24
    messages.upsert recebido + persister: mensagem persistida (2 msgs, instância Signum)
    conversation_id, contact_id, tenant_id gravados corretamente no banco
    ⚠️  n8n_forward_ok não aparece nos logs — verificar se n8n está disparando workflows
```

---

### Prioridade 4 — Build/Release Pipeline (próximas 2 semanas)

Elimina o maior risco operacional: build em produção sem rollback.

```
[x] 4.1 — GitHub Actions: CI para livia_dev_01                         ← 2026-04-23
    Arquivo: .github/workflows/ci.yml
    Trigger: PR para main + push para main
    Steps: npm ci → lint → type-check → build (com env vars fictícias)
    Impacto: detecta quebras antes do deploy  |  Esforço: 2h

[x] 4.2 — GitHub Actions: build e push da imagem Go                    ← 2026-04-23
    Arquivo: .github/workflows/release.yml (no repo livia-gateway)
    Trigger: push de tag v*.*.*
    Steps: go build ./... → docker build → push ghcr.io/frankmarcelino/livia-gateway:vX.X.X
    SSH configurado na VPS (id_github) para push com escopo workflow
    Impacto: artefato imutável, rollback em segundos  |  Esforço: 3h

[x] 4.3 — Stack yaml: usar imagem versionada do registry              ← 2026-04-23
    image: ghcr.io/frankmarcelino/livia-gateway:v1.0.0 (package público)
    Container rodando e (healthy) com imagem do registry
    Rollback agora é possível: basta trocar a tag no stack yaml
    Impacto: deploy reproduzível e reversível  |  Esforço: 30 min

[~] 4.4 — Branch protection em main                                   ← 2026-04-23
    Regra criada no GitHub mas NÃO enforced — repo privado exige plano Team/Enterprise
    CI roda em todo push/PR e indica falha visualmente (não bloqueia automaticamente)
    Reavaliara se migrar para GitHub Team ou tornar repo público
    Impacto: elimina push acidental para produção  |  Esforço: 30 min
```

---

### Prioridade 5 — Backup e Admin Processes (próximas 2 semanas)

Previne perda de dados e garante recuperação de desastre.

```
[x] 5.1 — Script de backup dos volumes críticos                        ← 2026-04-23
    Script: /root/backup.sh — pg_dump livia + sofhia + tar evolution sessions
    Cron: /etc/cron.d/livia-backup — diário às 3h, log em /root/backups/backup.log
    Retenção: 7 dias local em /root/backups/ (limpeza automática)
    Off-site: arquivos enviados via Telegram bot (liviamonitor_bot) após cada backup
    Alertas: ✅ sucesso ou ❌ erro enviados pelo mesmo bot
    Uptime Kuma: notificações configuradas via Telegram (mesmo bot/chat)
    Testado: 3 arquivos recebidos no Telegram + mensagem de confirmação
    Impacto: zero perda de dados  |  Esforço: 3h

⚠️  BACKLOG — LGPD: Backup files via Telegram
    Situação atual: pg_dump livia/sofhia (dados pessoais de clientes) é enviado
    diretamente ao Telegram. O Telegram não tem DPA com a empresa, os arquivos
    transitam por servidores deles — risco de conformidade com a LGPD.
    Solução planejada:
      - Separar notificação (Telegram — apenas status, sem dados pessoais)
        de armazenamento off-site (Backblaze B2 ou S3 com DPA adequado)
      - Remover envio de arquivos do backup.sh; manter só alertas de sucesso/erro
    Prazo: quando houver clientes reais / base ativa  |  Esforço: 2h

[x] 5.2 — Supabase migrations versionadas no git                      ← 2026-04-25
    supabase/migrations/ com 51 migrations (50 históricas + 1 baseline)
    supabase/config.toml criado (project_id + sa-east-1)
    CLI linkado ao projeto de produção (wfrxwfbslhkkzkexyilx) com senha do banco
    37 arquivos renomeados de YYYYMMDD para YYYYMMDDHHMMSS (11 datas com múltiplas migrations)
    schema_migrations remoto atualizado via Management API: 50/50 local = remoto
    Baseline criada: 20260101000000_baseline.sql — schema completo (enums, tabelas, sequences,
      funções onboarding, RLS) para shadow DB do CLI reproduzir o estado histórico
    npm run db:pull funcional: detectou e capturou drift em 20260425160607_remote_schema.sql
    Scripts adicionados ao package.json:
      npm run db:status  → supabase migration list (visualiza estado local vs remote)
      npm run db:new     → supabase migration new (cria migration com timestamp único)
      npm run db:pull    → db pull --linked --schema public (detecta drift do dashboard)
      npm run db:push    → lista migrations + db push --linked (push seguro)
    Regra: NUNCA criar arquivo .sql manualmente com prefixo YYYYMMDD
    Impacto: schema versionado ✅ | drift detection ✅ | workflow 100% funcional

[x] 3.5 — Fix n8n task runner: external → internal mode            ← 2026-04-25
    Problema: N8N_RUNNERS_MODE=external configurado em livia + sofhia sem container runner
    Todo Code node retornava "Task request timed out after 60 seconds" (timeout 60s)
    Causa raiz: modo external exige processo n8n-task-runner separado conectado ao broker —
      nenhum serviço runner estava definido nos stacks nem rodando no Swarm
    Correção: N8N_RUNNERS_MODE=internal em ambos os stacks (runner como processo filho do worker)
    Arquivos alterados: /root/stacks/livia.yaml + /root/stacks/sofhia.yaml
    Redeploy: docker stack deploy -c livia.yaml livia && docker stack deploy -c sofhia.yaml sofhia
    Confirmado nos logs: "Registered runner JS Task Runner" em livia_worker e sofhia_worker
    ⚠️  Python runner indisponível: Python 3 ausente na imagem n8nio/n8n:2.3.2 — esperado
      Se Python for necessário no futuro: usar imagem customizada + mode=external com runner próprio
    Impacto: Code nodes JavaScript funcionando em livia e sofhia  |  Esforço: 10 min

[~] 5.3 — Export automático de workflows n8n                          ← 2026-04-24
    Script criado: scripts/export-n8n-workflows.sh
    Exporta workflows individualmente + consolidado em n8n-workflows/
    Commit automático no git + notificação Telegram (mesmo bot do backup)
    ⚠️  ATIVAÇÃO — após migrar workflows para o n8n livia:
      1. Preencher N8N_URL e N8N_API_KEY no script (n8n → Settings → API)
      2. scp scripts/export-n8n-workflows.sh root@manager01:/root/
      3. crontab -e → 0 4 * * 1 /root/export-n8n-workflows.sh (segunda, 4h)
    Impacto: workflows recuperáveis após falha  |  Esforço: 5 min para ativar

[x] 5.4 — Runbook de disaster recovery                                ← 2026-04-24
    docs/RUNBOOK.md criado — 10 seções cobrindo do zero ao serviço rodando
    Cobre: VPS, DNS, Docker Swarm, deploy ordenado das stacks, restore de backup,
    cron jobs, verificação final, reconexão WhatsApp, referência rápida de serviços
    Impacto: reduz MTTR de horas para minutos  |  Esforço: 3h
```

---

### Prioridade 6 — Dev/Prod Parity (próximo mês)

Reduz bugs que só aparecem em produção.

```
[~] 6.1 — Projeto Supabase de staging                                 ← 2026-04-24
    Projeto criado: qejxaqqfdpmzahlrshws (sa-east-1)
    CLI linkado ao staging, migrations listadas (46 local, Remote vazio)
    Bloqueio: migrations esperam schema baseline que predates o histórico do CLI
      Todas as 46 migrations fazem ALTER TABLE — nenhuma cria tabelas do zero
      Para aplicar no staging precisa do schema de produção (pg_dump ou SQL Editor)
      pg_dump via CLI falhou: produção não tem DB password configurado no CLI
      n8n usa a DB URI da produção — não podemos resetar a senha
    ⚠️  BACKLOG: retomar após obter senha do banco de produção (Settings → Database)
      1. npx supabase link --project-ref wfrxwfbslhkkzkexyilx -p SENHA_PROD
      2. npx supabase db dump --linked -f supabase/migrations/000000000000_baseline.sql
      3. npx supabase link --project-ref qejxaqqfdpmzahlrshws -p '^c9)hJn5}rj7(k~q'
      4. npx supabase db push --linked --include-all
      5. Configurar Vercel preview com NEXT_PUBLIC_SUPABASE_URL do staging
    Credenciais staging salvas: ver docs/ENV_VARS.md

[x] 6.2 — docker-compose.yml local para livia-gateway               ← 2026-04-24
    local-dev/docker-compose.gateway.yml — dois modos via Docker profiles:
      Modo simples: gateway + webhook-echo (aponta para staging Supabase)
      Modo full (--profile full): + postgres + redis + n8n local (sem cloud)
    local-dev/.env.gateway.example — todas as vars com valores de staging
    Para ativar: clonar livia-gateway em ../livia-gateway → docker compose up
    Impacto: desenvolvimento do gateway sem acesso à VPS  |  Esforço: 3h

[~] 6.3 — n8n: instância de desenvolvimento separada                  ← backlog
    ⚠️  BACKLOG: retomar junto com a migração dos workflows antigos para o livia
    Motivo: VPS com recursos limitados + workflows ainda não migrados
    Quando retomar: criar stack livia-dev na VPS (n8n + postgres + redis)
    Impacto: testa workflows sem impactar produção  |  Esforço: 2h
```

---

### Prioridade 7 — Concurrency e Alta Disponibilidade (quando carga justificar)

Só faz sentido após o produto ter usuários suficientes para justificar o custo.

```
[ ] 7.1 — Segundo nó no Docker Swarm
    Adicionar worker node (segunda VPS Hostinger)
    Impacto: tolerância a falha de hardware  |  Esforço: 4h

[ ] 7.2 — livia-gateway: replicas 2
    Sessão sticky no Traefik para Evolution
    Impacto: zero downtime mesmo com falha de 1 réplica  |  Esforço: 2h

[ ] 7.3 — Placement labels nos nodes
    Remover constraint manager-only dos serviços de app
    Impacto: escala horizontal real  |  Esforço: 2h

[ ] 7.4 — Stack de observabilidade completa
    Loki + Grafana ou Seq para log aggregation
    Métricas de latência, volume de mensagens, erros
    Impacto: visibilidade total da plataforma  |  Esforço: 8h
```

---

## Integração com PLATFORM_EVOLUTION_PLAN.md

| Fase do Plano | 12-Factor relacionado | O que adicionar |
|---|---|---|
| Fase 2 — Go Gateway (atual) | V, IX, XI | CI/CD da imagem Go; health check; logs estruturados |
| Fase 2 — Fix Evolution DB | III, XII | Stack yaml correto; versionado no repo de infra |
| Fase 3 — Multi-agente | XII | Migrations Supabase versionadas no git |
| Fase 4 — Logs de Canal | XI | Uptime Kuma + alerta; rotação de logs |
| Fase 5 — CRM | X | Staging Supabase; CI completo |
| Todos | I, II | Branch protection; imagens versionadas |

---

## Estado da Infra — Snapshot 2026-04-22

### Serviços rodando na VPS `manager01` (187.127.16.101)

| Serviço | Stack | Imagem | Replicas | Status |
|---|---|---|---|---|
| traefik | traefik | traefik:v3.6.1 | 1/1 | ✅ Saudável — 11 dias up |
| evolution_v2 | evolution_v2 | evoapicloud/evolution-api:v2.3.6 | 1/1 | ⚠️ Up mas DB com erro de auth |
| livia-gateway | livia-gateway | livia-gateway:latest | 1/1 | ✅ Shadow mode ativo — 25h up |
| livia_editor | livia | n8nio/n8n:2.3.2 | 1/1 | ✅ Saudável — 9 dias up |
| livia_webhook | livia | n8nio/n8n:2.3.2 | 1/1 | ✅ Saudável — 9 dias up |
| livia_worker | livia | n8nio/n8n:2.3.2 | 1/1 | ✅ Saudável — JS Task Runner registrado (2026-04-25) |
| livia_postgres | livia | postgres:16-alpine | 1/1 | ✅ Saudável — 9 dias up |
| livia_redis | livia | redis:7.2-alpine | 1/1 | ✅ Saudável — 9 dias up |
| sofhia_* | sofhia | n8nio/n8n:2.3.2 + postgres + redis | 5/5 | ✅ Saudável — JS Task Runner registrado (2026-04-25) |
| rabbitmq | rabbitmq | rabbitmq:3.12.14-management | 1/1 | ✅ Saudável — 11 dias up |
| portainer | portainer | portainer-ce:latest | 2/2 | ✅ Saudável — 11 dias up |

### Problema conhecido: Evolution DB

- **Causa:** Evolution esperava postgres standalone (senha `BTudZJDU09M3`)
  mas o DNS `postgres` resolve para `livia_postgres` (senha `Mv8nKpXqR2wLivia`)
- **Solução preparada:** `evolution_user` criado no `livia_postgres` com
  senha `BTudZJDU09M3` e banco `evolution` já existente
- **Pendente:** redeploy do stack com `DATABASE_CONNECTION_URI` corrigida

### Recursos da VPS

| Recurso | Total | Usado | Livre |
|---|---|---|---|
| RAM | 7.8 GB | 2.5 GB | 5.3 GB |
| Disco | 99 GB | 8.3 GB | 86 GB |
| CPU | 2 cores | — | — |
| Nodes Swarm | 1 | — | Single node |

### Rede

- Overlay: `network_swarm_public` — todos os serviços nesta rede
- DNS interno: `service_name:port` (ex: `livia_postgres:5432`)
- Ingress: Traefik v3.6.1 com Let's Encrypt HTTP-01
- Todos os domínios: subdomínios de `online24por7.ai`

### Repositórios

| Repo | URL | Propósito |
|---|---|---|
| livia_dev_01 | github.com/FrankMarcelino/livia_dev_01 | Next.js app + documentação |
| livia-gateway | github.com/FrankMarcelino/livia-gateway | Go Message Gateway |
| infra | github.com/FrankMarcelino/Setup-Base-Docker-Swarm-Traefik-Portainer-Ctop | Stack yamls e config |

---

## Próximos Passos Imediatos (ordem exata)

```
1. [x] Remover PAT do git remote                              ← 2026-04-22
2. [x] Restaurar .env.local.example + docs/ENV_VARS.md        ← 2026-04-22
3. [ ] Redeploy Evolution com DATABASE_CONNECTION_URI correto (desbloqueio Fase 2 — 30 min)
4. [ ] Configurar webhook Evolution → livia-gateway (Fase 2 Passo 1 — 30 min)
5. [ ] Configurar rotação de logs no Docker daemon (risco operacional — 10 min)
6. [ ] Instalar Uptime Kuma na VPS (observabilidade — 1h)
```

---

*Documento criado em 2026-04-22.*  
*Referências: [12factor.net](https://12factor.net) · [PLATFORM_EVOLUTION_PLAN.md](./PLATFORM_EVOLUTION_PLAN.md)*
