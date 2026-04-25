#!/bin/bash
# Aplica todas as migrations no projeto Supabase de staging.
# Usar apenas uma vez, na criação do ambiente de staging.
#
# USO:
#   STAGING_DB_URL="postgresql://postgres:SENHA@db.PROJECT_REF.supabase.co:5432/postgres" \
#   bash scripts/apply-migrations-staging.sh

set -euo pipefail

STAGING_DB_URL="${STAGING_DB_URL:-}"
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

if [[ -z "$STAGING_DB_URL" ]]; then
  echo "ERRO: defina STAGING_DB_URL antes de rodar"
  echo "  export STAGING_DB_URL='postgresql://postgres:SENHA@db.SEU_REF.supabase.co:5432/postgres'"
  exit 1
fi

echo "Aplicando migrations em: $STAGING_DB_URL"
echo ""

TOTAL=$(ls "$MIGRATIONS_DIR"/*.sql | wc -l)
COUNT=0
ERRORS=0

for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  COUNT=$((COUNT + 1))
  printf "[%2d/%d] %s ... " "$COUNT" "$TOTAL" "$name"

  if psql "$STAGING_DB_URL" -f "$file" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
    echo "✅"
  else
    echo "❌"
    ERRORS=$((ERRORS + 1))
    echo "       → Erro ao aplicar $file"
    echo "       → Rodando com output para diagnóstico:"
    psql "$STAGING_DB_URL" -f "$file" 2>&1 | tail -5 | sed 's/^/         /'
  fi
done

echo ""
echo "─────────────────────────────────────"
echo "Total: $TOTAL | OK: $((TOTAL - ERRORS)) | Erros: $ERRORS"

if [[ $ERRORS -gt 0 ]]; then
  echo "⚠️  Algumas migrations falharam — revisar manualmente"
  exit 1
else
  echo "✅ Todas as migrations aplicadas com sucesso"
fi
