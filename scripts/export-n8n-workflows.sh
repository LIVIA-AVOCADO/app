#!/bin/bash
# Exporta todos os workflows do n8n para JSON versionado no git.
# Roda via cron semanal na VPS. Ver docs/12FACTOR_PLAN.md item 5.3.
#
# ATIVAÇÃO — preencher as variáveis abaixo e copiar este script para a VPS:
#   scp scripts/export-n8n-workflows.sh root@manager01:/root/export-n8n-workflows.sh
#   chmod +x /root/export-n8n-workflows.sh
#   crontab -e  →  0 4 * * 1 /root/export-n8n-workflows.sh >> /root/backups/n8n-export.log 2>&1

set -euo pipefail

# ── Configuração ─────────────────────────────────────────────────────────────
N8N_URL="${N8N_URL:-}"           # ex: https://n8n-livia.online24por7.ai
N8N_API_KEY="${N8N_API_KEY:-}"   # n8n → Settings → API → Create API Key
REPO_DIR="${REPO_DIR:-/root/livia_dev_01}"
EXPORT_DIR="$REPO_DIR/supabase/../n8n-workflows"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# ── Validação ─────────────────────────────────────────────────────────────────
if [[ -z "$N8N_URL" || -z "$N8N_API_KEY" ]]; then
  echo "$(date -u +%FT%TZ) [ERRO] N8N_URL e N8N_API_KEY são obrigatórios"
  exit 1
fi

notify() {
  local msg="$1"
  if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" \
      -d text="$msg" > /dev/null
  fi
  echo "$(date -u +%FT%TZ) $msg"
}

# ── Export ────────────────────────────────────────────────────────────────────
mkdir -p "$EXPORT_DIR"
cd "$REPO_DIR"

notify "n8n export: iniciando..."

# Exporta lista de workflows
WORKFLOWS=$(curl -sf \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows?limit=100")

if [[ -z "$WORKFLOWS" ]]; then
  notify "❌ n8n export: falha ao buscar workflows (resposta vazia)"
  exit 1
fi

# Salva o arquivo consolidado
echo "$WORKFLOWS" | python3 -m json.tool > "$EXPORT_DIR/workflows.json"

# Exporta cada workflow individualmente
TOTAL=$(echo "$WORKFLOWS" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data.get('data', [])))")
echo "$WORKFLOWS" | python3 -c "
import sys, json, os
data = json.load(sys.stdin)
export_dir = os.environ.get('EXPORT_DIR', '.')
for wf in data.get('data', []):
    name = wf.get('name', 'unnamed').replace('/', '_').replace(' ', '_')
    fname = f\"{export_dir}/{wf['id']}_{name}.json\"
    with open(fname, 'w') as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
"

# Commit se houver mudanças
if git diff --quiet "$EXPORT_DIR" && git ls-files --others --exclude-standard "$EXPORT_DIR" | grep -q .; then
  git add "$EXPORT_DIR"
  git commit -m "chore(n8n): export automático de workflows — $(date -u +%Y-%m-%d)"
  git push origin main
  notify "✅ n8n export: $TOTAL workflows exportados e commitados"
else
  git add "$EXPORT_DIR" 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "chore(n8n): export automático de workflows — $(date -u +%Y-%m-%d)"
    git push origin main
    notify "✅ n8n export: $TOTAL workflows exportados e commitados"
  else
    notify "ℹ️  n8n export: sem alterações desde o último export"
  fi
fi
