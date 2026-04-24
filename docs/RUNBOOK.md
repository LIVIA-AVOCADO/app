# LIVIA — Runbook de Disaster Recovery

**Objetivo:** Recriar toda a infraestrutura LIVIA do zero em uma nova VPS.  
**Tempo estimado:** 2–3 horas (com backups disponíveis).  
**Última revisão:** 2026-04-24

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Provisionar VPS](#2-provisionar-vps)
3. [Configurar DNS](#3-configurar-dns)
4. [Instalar Docker e Swarm](#4-instalar-docker-e-swarm)
5. [Clonar stacks de infra](#5-clonar-stacks-de-infra)
6. [Deploy das stacks (ordem obrigatória)](#6-deploy-das-stacks-ordem-obrigatória)
7. [Restaurar backups](#7-restaurar-backups)
8. [Configurar cron jobs](#8-configurar-cron-jobs)
9. [Verificação final](#9-verificação-final)
10. [Referência rápida de serviços](#10-referência-rápida-de-serviços)

---

## 1. Pré-requisitos

### O que você precisa ter em mãos antes de começar

- [ ] Acesso ao painel Hostinger (para provisionar VPS e configurar DNS)
- [ ] Acesso ao GitHub (`FrankMarcelino`) — para clonar os repos
- [ ] Credenciais dos serviços (Evolution API key, n8n keys, etc.) — guardadas nos stack yamls do repo de infra
- [ ] Backups mais recentes de `/root/backups/` da VPS anterior (ou Telegram)
- [ ] Acesso à conta Telegram do bot de alertas (`liviamonitor_bot`)

### Repositórios

| Repo | URL | Conteúdo |
|---|---|---|
| infra | `github.com/FrankMarcelino/Setup-Base-Docker-Swarm-Traefik-Portainer-Ctop` | Stack yamls sanitizados |
| gateway | `github.com/FrankMarcelino/livia-gateway` | Código Go do gateway |
| app | `github.com/FrankMarcelino/livia_dev_01` | Next.js + docs |

---

## 2. Provisionar VPS

### Hostinger — configurações mínimas

| Recurso | Mínimo | Atual |
|---|---|---|
| RAM | 4 GB | 8 GB |
| Disco | 40 GB | 100 GB |
| CPU | 2 vCPU | 2 vCPU |
| OS | Debian 12 | Debian 12 |

1. Criar VPS no Hostinger com **Debian 12**
2. Anotar o IP público (ex: `187.x.x.x`)
3. Acessar via SSH como root: `ssh root@<IP>`
4. Configurar hostname:
```bash
hostnamectl set-hostname manager01
echo "127.0.0.1 manager01" >> /etc/hosts
```

### Configurar SSH key local

Na **sua máquina local**, adicionar entrada no `~/.ssh/config`:
```
Host manager01
  HostName <IP_NOVO>
  User root
  IdentityFile ~/.ssh/id_livia_vps
```

---

## 3. Configurar DNS

**ANTES de deployar qualquer stack** — o Traefik tenta obter certificado SSL via ACME imediatamente ao subir. Se o DNS não apontar para a VPS, o certificado falha e fica em rate limit por horas.

No painel DNS de `online24por7.ai`, criar os seguintes registros **A** apontando para o IP da nova VPS:

| Subdomínio | Tipo | Destino |
|---|---|---|
| `monitor` | A | `<IP_NOVO>` |
| `portainer` | A | `<IP_NOVO>` |
| `rabbitmq` | A | `<IP_NOVO>` |
| `livia-edit` | A | `<IP_NOVO>` |
| `livia-wh` | A | `<IP_NOVO>` |
| `livia.wsapi` | A | `<IP_NOVO>` |
| `livia-gw` | A | `<IP_NOVO>` |
| `sofhia-edit` | A | `<IP_NOVO>` |
| `sofhia-wh` | A | `<IP_NOVO>` |
| `livia.app` | A | `<IP_NOVO>` |

Verificar propagação antes de continuar:
```bash
dig +short monitor.online24por7.ai
# deve retornar o IP novo
```

---

## 4. Instalar Docker e Swarm

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Configurar rotação de logs (obrigatório — evita disco cheio)
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker

# Inicializar Swarm
docker swarm init --advertise-addr <IP_NOVO>

# Criar rede overlay compartilhada
docker network create --driver overlay --attachable network_swarm_public
```

---

## 5. Clonar stacks de infra

```bash
# Configurar SSH key para GitHub (se necessário)
ssh-keygen -t ed25519 -f ~/.ssh/id_github -C "manager01"
cat ~/.ssh/id_github.pub
# Adicionar como Deploy Key no repo de infra no GitHub

# Clonar repo de infra
cd /root
git clone git@github.com:FrankMarcelino/Setup-Base-Docker-Swarm-Traefik-Portainer-Ctop.git infra
ls /root/infra/stacks/
# deve listar: traefik.yaml, livia.yaml, sofhia.yaml, evolution_v2.yaml, livia-gateway.yaml, etc.
```

Os stack yamls no repo têm credenciais substituídas por `SEU_*`. Antes de deployar, preencher os valores reais em cada arquivo. As credenciais estão documentadas no `docs/ENV_VARS.md` do repo `livia_dev_01`.

```bash
# Criar diretório de stacks operacionais (nunca commitar com credenciais)
mkdir -p /root/stacks
cp /root/infra/stacks/*.yaml /root/stacks/
# Editar cada arquivo e substituir os placeholders SEU_*
```

---

## 6. Deploy das stacks (ordem obrigatória)

A ordem importa por causa das dependências de rede e banco de dados.

### 6.1 Traefik (proxy reverso + SSL)

```bash
docker stack deploy -c /root/stacks/traefik.yaml traefik
docker service ls | grep traefik
# aguardar status 1/1
```

Verificar: `curl -I https://monitor.online24por7.ai` deve retornar 200 ou redirect (confirma SSL ativo).

### 6.2 Portainer (gerenciamento visual)

```bash
docker stack deploy -c /root/stacks/portainer.yaml portainer
# Acessar: https://portainer.online24por7.ai
# Criar usuário admin na primeira vez (janela de 5 min)
```

### 6.3 RabbitMQ (fila — necessário para Evolution)

```bash
docker stack deploy -c /root/stacks/rabbitmq.yaml rabbitmq
docker service ls | grep rabbitmq
# aguardar status 1/1 antes de deployar Evolution
```

### 6.4 n8n Livia (editor + webhook + worker + postgres + redis)

```bash
docker stack deploy -c /root/stacks/livia.yaml livia
docker service ls | grep livia
# 5 serviços: editor, webhook, worker, postgres, redis
# aguardar todos 1/1 antes de continuar
```

### 6.5 n8n Sofhia

```bash
docker stack deploy -c /root/stacks/sofhia.yaml sofhia
docker service ls | grep sofhia
# 5 serviços — aguardar todos 1/1
```

### 6.6 Evolution API v2

**Pré-requisito:** RabbitMQ e livia_postgres UP.

```bash
# Criar usuário evolution no postgres livia
docker exec -it $(docker ps -q -f name=livia_postgres) \
  psql -U postgres -c "CREATE USER evolution_user WITH PASSWORD 'SENHA_EVOLUTION';"
docker exec -it $(docker ps -q -f name=livia_postgres) \
  psql -U postgres -c "CREATE DATABASE evolution OWNER evolution_user;"

docker stack deploy -c /root/stacks/evolution_v2.yaml evolution_v2
docker service logs evolution_v2_evolution -f
# aguardar: "HTTP server started" sem erros de DB
```

### 6.7 livia-gateway

```bash
docker stack deploy -c /root/stacks/livia-gateway.yaml livia-gateway
docker service logs livia-gateway_app -f
# deve ver: "livia-gateway iniciado" + "servidor HTTP pronto"
```

### 6.8 Uptime Kuma (monitoramento)

```bash
docker stack deploy -c /root/stacks/uptime-kuma.yaml uptime-kuma
# Acessar: https://monitor.online24por7.ai
# Criar usuário admin
# Reconfigurar monitores (ver seção 10)
```

---

## 7. Restaurar backups

Os backups ficam em `/root/backups/` na VPS anterior, e também enviados via Telegram pelo `liviamonitor_bot`.

### 7.1 Obter os arquivos de backup

**Da VPS anterior (se ainda acessível):**
```bash
scp root@<IP_ANTIGO>:/root/backups/livia_postgres_*.sql.gz /tmp/
scp root@<IP_ANTIGO>:/root/backups/sofhia_postgres_*.sql.gz /tmp/
scp root@<IP_ANTIGO>:/root/backups/evolution_sessions_*.tar.gz /tmp/
```

**Do Telegram:** baixar os arquivos enviados pelo bot nas últimas 24h.

### 7.2 Restaurar banco livia

```bash
# Identificar o container postgres
LIVIA_PG=$(docker ps -q -f name=livia_postgres)

# Restaurar dump
gunzip -c /tmp/livia_postgres_YYYY-MM-DD.sql.gz | \
  docker exec -i $LIVIA_PG psql -U postgres -d livia_production
```

### 7.3 Restaurar banco sofhia

```bash
SOFHIA_PG=$(docker ps -q -f name=sofhia_postgres)
gunzip -c /tmp/sofhia_postgres_YYYY-MM-DD.sql.gz | \
  docker exec -i $SOFHIA_PG psql -U postgres -d sofhia_production
```

### 7.4 Restaurar sessões WhatsApp (Evolution)

```bash
# Parar Evolution antes de restaurar
docker service scale evolution_v2_evolution=0

# Identificar volume
docker volume ls | grep evolution

# Restaurar sessões
tar -xzf /tmp/evolution_sessions_YYYY-MM-DD.tar.gz -C /var/lib/docker/volumes/

# Reiniciar Evolution
docker service scale evolution_v2_evolution=1
docker service logs evolution_v2_evolution -f
# Aguardar reconexão WhatsApp (pode levar 1-2 min)
```

---

## 8. Configurar cron jobs

```bash
# Script de backup diário
cp /root/infra/scripts/backup.sh /root/backup.sh
chmod +x /root/backup.sh
# Editar variáveis: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, senhas dos bancos

# Registrar no cron
cat > /etc/cron.d/livia-backup <<EOF
0 3 * * * root /root/backup.sh >> /root/backups/backup.log 2>&1
EOF

# Testar
/root/backup.sh
# deve receber confirmação no Telegram
```

---

## 9. Verificação final

Execute cada check abaixo. Todos devem passar antes de considerar a recuperação concluída.

```bash
# Todos os serviços UP
docker service ls
# Esperado: todas as réplicas X/X sem falha

# Gateway respondendo
curl -sf https://livia-gw.online24por7.ai/health
# Esperado: {"status":"ok"}

# Evolution respondendo
curl -sf -H "apikey: SUA_API_KEY" \
  https://livia.wsapi.online24por7.ai/instance/fetchInstances
# Esperado: lista de instâncias

# Next.js + Supabase
curl -sf https://livia.app.online24por7.ai/api/health
# Esperado: {"status":"ok","latency_ms":N}

# Logs do gateway sem erro
docker service logs livia-gateway_app --tail 20
# Esperado: sem "error" ou "panic"
```

### Reconectar instâncias WhatsApp

Após restaurar os volumes da Evolution, as instâncias geralmente reconectam automaticamente. Se não:

```bash
# Verificar estado
curl -sf -H "apikey: SUA_API_KEY" \
  https://livia.wsapi.online24por7.ai/instance/fetchInstances | jq '.[].state'

# Se desconectado, forçar reconexão
curl -X DELETE -H "apikey: SUA_API_KEY" \
  https://livia.wsapi.online24por7.ai/instance/logout/NOME_INSTANCIA
# Depois reconectar via QR code no Evolution Manager
```

### Reconfigurar Uptime Kuma

Monitores a recriar em `https://monitor.online24por7.ai`:

| Monitor | URL / Host | Tipo | Intervalo |
|---|---|---|---|
| livia-gateway | `https://livia-gw.online24por7.ai/health` | HTTP | 60s |
| Evolution API | `https://livia.wsapi.online24por7.ai` | HTTP | 60s |
| n8n livia editor | `https://livia-edit.online24por7.ai` | HTTP | 60s |
| n8n livia webhook | `https://livia-wh.online24por7.ai/healthz` | HTTP | 60s |
| n8n sofhia editor | `https://sofhia-edit.online24por7.ai` | HTTP | 60s |
| n8n sofhia webhook | `https://sofhia-wh.online24por7.ai/healthz` | HTTP | 60s |
| Supabase | `db.wfrxwfbslhkkzkexyilx.supabase.co` | TCP 443 | 60s |
| Next.js (Vercel) | `https://livia.app.online24por7.ai/api/health` | HTTP | 60s |

Notificações: configurar via Telegram (mesmo bot/chat do backup).

---

## 10. Referência rápida de serviços

| Serviço | URL | Stack | Porta interna |
|---|---|---|---|
| Traefik dashboard | `https://traefik.online24por7.ai` | traefik | 8080 |
| Portainer | `https://portainer.online24por7.ai` | portainer | 9000 |
| RabbitMQ management | `https://rabbitmq.online24por7.ai` | rabbitmq | 15672 |
| n8n livia editor | `https://livia-edit.online24por7.ai` | livia | 5678 |
| n8n livia webhook | `https://livia-wh.online24por7.ai` | livia | 5678 |
| n8n sofhia editor | `https://sofhia-edit.online24por7.ai` | sofhia | 5678 |
| n8n sofhia webhook | `https://sofhia-wh.online24por7.ai` | sofhia | 5678 |
| Evolution API | `https://livia.wsapi.online24por7.ai` | evolution_v2 | 8080 |
| livia-gateway | `https://livia-gw.online24por7.ai` | livia-gateway | 8080 |
| Uptime Kuma | `https://monitor.online24por7.ai` | uptime-kuma | 3001 |

### Comandos úteis

```bash
# Ver todos os serviços e status
docker service ls

# Logs de um serviço
docker service logs <nome_servico> -f --tail 50

# Reiniciar um serviço
docker service update --force <nome_servico>

# Ver containers rodando
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Espaço em disco
df -h /

# Memória
free -h
```

---

*Documento criado em 2026-04-24.*  
*Referências: [12FACTOR_PLAN.md](./12FACTOR_PLAN.md) · [ENV_VARS.md](./ENV_VARS.md) · [PLATFORM_EVOLUTION_PLAN.md](./PLATFORM_EVOLUTION_PLAN.md)*
