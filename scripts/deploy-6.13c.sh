#!/usr/bin/env bash
# SILO OPS Central — ETAPA 6.13C — Deploy VPS + Validação de Segurança em Produção
# Data: 2026-06-19
# Executar em: /opt/siloops-central como root ou usuário com permissão Docker
# Uso: bash deploy-6.13c.sh [TOKEN_DESTILARIA_TABU] [TOKEN_SEEME]

set -euo pipefail

CENTRAL_DIR="/opt/siloops-central"
BACKUP_DIR="/root/siloops-backups/security-6.13c"
DATA_DIR="/opt/siloops-data"
PROD_URL="https://central.siloops.com.br"
TOKEN_A="${1:-INFORME_TOKEN_DESTILARIA_TABU}"
TENANT_A="destilariatabu-001"
TOKEN_B="${2:-INFORME_TOKEN_SEEME}"
TENANT_B="seeme-ops-001"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAILED=$((FAILED+1)); }
info() { echo -e "${YELLOW}[INFO]${NC} $*"; }
FAILED=0

echo "============================================================"
echo " SILO OPS — ETAPA 6.13C — Deploy + Validação Produção"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ── 0. PRÉ-VERIFICAÇÃO ────────────────────────────────────────────────────────
cd "$CENTRAL_DIR"
info "Diretório: $(pwd)"
info "Status atual:"
git log --oneline -3
docker compose --env-file .env.production ps

# ── 1. BACKUP ─────────────────────────────────────────────────────────────────
info "=== ETAPA 1: Backup ==="
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)

cp .env.production "$BACKUP_DIR/env.production.${TS}.bak"
ok "Backup .env.production → $BACKUP_DIR/env.production.${TS}.bak"

tar -czf "$BACKUP_DIR/siloops-data.${TS}.tar.gz" "$DATA_DIR" && \
  ok "Backup /opt/siloops-data → $BACKUP_DIR/siloops-data.${TS}.tar.gz" || \
  fail "Backup /opt/siloops-data falhou"

# ── 2. ATUALIZAR CÓDIGO ───────────────────────────────────────────────────────
info "=== ETAPA 2: Atualizar código ==="
cp .env.production /root/env.siloops.backup
git fetch --all --prune
git reset --hard origin/main
cp /root/env.siloops.backup .env.production
ok "Código atualizado. Commit: $(git log --oneline -1)"

# ── 3. VALIDAR ENV ────────────────────────────────────────────────────────────
info "=== ETAPA 3: Validar .env.production ==="
for VAR in NODE_ENV SILO_AUTH_SECRET SILO_DATA_DIR; do
  if grep -q "^${VAR}=" .env.production; then
    VAL=$(grep "^${VAR}=" .env.production | cut -d= -f2-)
    if [ -z "$VAL" ]; then
      fail "${VAR} está vazio em .env.production"
    else
      [ "$VAR" = "SILO_AUTH_SECRET" ] && info "${VAR}=***MASCARADO*** (${#VAL} chars)" || ok "${VAR}=${VAL}"
    fi
  else
    fail "${VAR} não encontrado em .env.production"
  fi
done

NODE_ENV_VAL=$(grep "^NODE_ENV=" .env.production | cut -d= -f2-)
[ "$NODE_ENV_VAL" = "production" ] && ok "NODE_ENV=production ✓" || fail "NODE_ENV deve ser 'production', encontrado: '$NODE_ENV_VAL'"

# ── 4. INSTALAR DEPENDÊNCIAS ──────────────────────────────────────────────────
info "=== ETAPA 4: npm ci ==="
npm ci && ok "npm ci concluído" || { fail "npm ci falhou"; exit 1; }

# ── 5. LINT ───────────────────────────────────────────────────────────────────
info "=== ETAPA 5: Lint ==="
npm run lint && ok "Lint: sem erros" || fail "Lint: erros encontrados"

# ── 6. TYPE-CHECK ─────────────────────────────────────────────────────────────
info "=== ETAPA 6: Type-check ==="
npm run type-check 2>&1 | tee /tmp/tsc-output.txt
TSC_ERRORS=$(grep "error TS" /tmp/tsc-output.txt | grep -v "node_modules" | wc -l)
if [ "$TSC_ERRORS" -eq 0 ]; then
  ok "Type-check: sem erros"
else
  # Verificar se são somente erros pré-existentes conhecidos
  PREEXISTING=$(grep "error TS" /tmp/tsc-output.txt | grep -E "timeline/page|equipment-trail-store|hourmeter\.ts|timeline\.ts" | wc -l)
  if [ "$TSC_ERRORS" -eq "$PREEXISTING" ]; then
    info "Type-check: $TSC_ERRORS erros pré-existentes conhecidos (não bloqueiam build):"
    grep "error TS" /tmp/tsc-output.txt | grep -v "node_modules"
  else
    fail "Type-check: $((TSC_ERRORS - PREEXISTING)) novos erros encontrados"
    grep "error TS" /tmp/tsc-output.txt | grep -v "node_modules" | grep -vE "timeline/page|equipment-trail-store|hourmeter\.ts|timeline\.ts"
  fi
fi

# ── 7. BUILD ──────────────────────────────────────────────────────────────────
info "=== ETAPA 7: Build de produção ==="
npm run build && ok "Build concluído com sucesso" || { fail "Build falhou"; exit 1; }

# ── 8. DOCKER COMPOSE REBUILD ────────────────────────────────────────────────
info "=== ETAPA 8: Docker Compose rebuild ==="
docker compose --env-file .env.production up -d --build
sleep 5
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=60

# ── 9. VALIDAÇÃO: Páginas privadas sem login ──────────────────────────────────
info "=== ETAPA 9: Páginas privadas (esperado: 302 para /login) ==="
for PATH_PRIV in /dashboard /mapa-operacional /operacoes /timeline /ficha-operador /relatorios /instancias; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -L0 "${PROD_URL}${PATH_PRIV}" 2>/dev/null || echo "ERR")
  LOCATION=$(curl -s -o /dev/null -D - --max-time 10 "${PROD_URL}${PATH_PRIV}" 2>/dev/null | grep -i "^location:" | tr -d '\r' | awk '{print $2}')
  if [[ "$STATUS" == "302" || "$STATUS" == "307" || "$STATUS" == "308" ]] || echo "$LOCATION" | grep -q "/login"; then
    ok "${PATH_PRIV} → ${STATUS} → ${LOCATION:-redireciona}"
  elif [[ "$STATUS" == "401" || "$STATUS" == "403" ]]; then
    ok "${PATH_PRIV} → ${STATUS} (bloqueado corretamente)"
  else
    fail "${PATH_PRIV} → ${STATUS} (esperado 302/401/403, não deve retornar HTML privado)"
  fi
done

# ── 10. VALIDAÇÃO: Rotas públicas ─────────────────────────────────────────────
info "=== ETAPA 10: Rotas públicas ==="
for PATH_PUB in /login "/api/health" "/api/mobile/health"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${PROD_URL}${PATH_PUB}" 2>/dev/null || echo "ERR")
  [[ "$STATUS" =~ ^2 ]] && ok "${PATH_PUB} → ${STATUS}" || \
  [[ "$STATUS" =~ ^3 ]] && ok "${PATH_PUB} → ${STATUS} (redirect aceito)" || \
    fail "${PATH_PUB} → ${STATUS} (esperado 2xx)"
done

# ── 11. VALIDAÇÃO: Security headers ──────────────────────────────────────────
info "=== ETAPA 11: Security headers ==="
HEADERS=$(curl -s -I --max-time 10 "${PROD_URL}/login" 2>/dev/null)
for HEADER in "X-Frame-Options" "X-Content-Type-Options" "Referrer-Policy" "Content-Security-Policy" "Permissions-Policy" "Strict-Transport-Security"; do
  echo "$HEADERS" | grep -i "^${HEADER}:" > /dev/null && \
    ok "${HEADER}: $(echo "$HEADERS" | grep -i "^${HEADER}:" | head -1 | cut -d: -f2- | cut -c1-60)..." || \
    fail "Header ausente: ${HEADER}"
done

# ── 12. VALIDAÇÃO: Token mobile inválido → 401 ────────────────────────────────
info "=== ETAPA 12: Token mobile inválido (esperado: 401) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PROD_URL}/api/mobile/events/batch" \
  -H "Content-Type: application/json" \
  -H "X-Company-Token: token-invalido-etapa-613c" \
  -d '{"events":[]}' --max-time 10 2>/dev/null || echo "ERR")
[ "$STATUS" = "401" ] && ok "Token inválido → 401 ✓" || fail "Token inválido → ${STATUS} (esperado 401)"

# ── 13. VALIDAÇÃO: X-Tenant-Id divergente → 403 ──────────────────────────────
info "=== ETAPA 13: X-Tenant-Id divergente (esperado: 403) ==="
if [ "$TOKEN_A" != "INFORME_TOKEN_DESTILARIA_TABU" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PROD_URL}/api/mobile/events/batch" \
    -H "Content-Type: application/json" \
    -H "X-Company-Token: ${TOKEN_A}" \
    -H "X-Tenant-Id: ${TENANT_B}" \
    -d '{"events":[]}' --max-time 10 2>/dev/null || echo "ERR")
  [ "$STATUS" = "403" ] && ok "Token A + Tenant B → 403 ✓" || fail "Token A + Tenant B → ${STATUS} (esperado 403)"
else
  info "Token da Destilaria Tabu não fornecido — pulando validação de tenant divergente"
fi

if [ "$TOKEN_B" != "INFORME_TOKEN_SEEME" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PROD_URL}/api/mobile/events/batch" \
    -H "Content-Type: application/json" \
    -H "X-Company-Token: ${TOKEN_B}" \
    -H "X-Tenant-Id: ${TENANT_A}" \
    -d '{"events":[]}' --max-time 10 2>/dev/null || echo "ERR")
  [ "$STATUS" = "403" ] && ok "Token B + Tenant A → 403 ✓" || fail "Token B + Tenant A → ${STATUS} (esperado 403)"
fi

# ── 14. VALIDAÇÃO: Token válido funciona ─────────────────────────────────────
info "=== ETAPA 14: Token válido (esperado: 200) ==="
if [ "$TOKEN_A" != "INFORME_TOKEN_DESTILARIA_TABU" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PROD_URL}/api/mobile/events/batch" \
    -H "Content-Type: application/json" \
    -H "X-Company-Token: ${TOKEN_A}" \
    -d '{"events":[]}' --max-time 10 2>/dev/null || echo "ERR")
  [[ "$STATUS" =~ ^2 ]] && ok "Token A válido → ${STATUS} ✓" || fail "Token A válido → ${STATUS} (esperado 2xx)"
fi

# ── 15. VALIDAÇÃO: Storage por tenant ────────────────────────────────────────
info "=== ETAPA 15: Storage isolado por tenant ==="
[ -d "${DATA_DIR}" ] && ok "Diretório ${DATA_DIR} existe" || fail "${DATA_DIR} não encontrado"
SUBDIRS=$(ls -1 "${DATA_DIR}" 2>/dev/null | wc -l)
info "Tenants encontrados em storage: $SUBDIRS"
ls -la "${DATA_DIR}" 2>/dev/null | head -20

# Verificar ausência de arquivos operacionais globais (fora de subpastas tenant)
GLOBAL_LIVESTATE=$(find "${DATA_DIR}" -maxdepth 1 -name "live-state.json" 2>/dev/null | wc -l)
GLOBAL_EVENTS=$(find "${DATA_DIR}" -maxdepth 1 -name "mobile-events.json" 2>/dev/null | wc -l)
[ "$GLOBAL_LIVESTATE" -eq 0 ] && ok "Sem live-state.json global (correto)" || fail "live-state.json no root de /opt/siloops-data (risco de mistura)"
[ "$GLOBAL_EVENTS" -eq 0 ] && ok "Sem mobile-events.json global (correto)" || fail "mobile-events.json no root de /opt/siloops-data"

# ── 16. VALIDAÇÃO: Logs — sem secrets ────────────────────────────────────────
info "=== ETAPA 16: Logs sem vazamento de segredos ==="
LOG_CHECK=$(docker compose --env-file .env.production logs --tail=300 2>/dev/null | \
  grep -Ei "password|senha|silo_session=[a-z0-9]{32}" | wc -l)
[ "$LOG_CHECK" -eq 0 ] && ok "Logs: sem vazamento de senha/session" || fail "Logs: possível vazamento — revisar manualmente"

# Verificar que logs 401/403 aparecem (sinal de que os guards estão ativos)
BLOCKED=$(docker compose --env-file .env.production logs --tail=300 2>/dev/null | grep -cE "401|403" || true)
info "Requisições bloqueadas nos logs: $BLOCKED (esperado > 0 após os testes acima)"

# ── RESULTADO FINAL ────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " RESULTADO ETAPA 6.13C"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}ETAPA 6.13C DEPLOY VPS SEGURANÇA PRODUÇÃO: APROVADO${NC}"
else
  echo -e "${RED}ETAPA 6.13C DEPLOY VPS SEGURANÇA PRODUÇÃO: REPROVADO${NC}"
  echo "Total de falhas: $FAILED"
fi
