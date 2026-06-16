#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SILO OPS — Validação E2E real
# Executar na VPS ou máquina local após: npm run build && npm run start
#
# Uso:
#   chmod +x validate-e2e.sh
#   BASE_URL=http://localhost:3000 COMPANY_TOKEN=CMP-SILO-OPS-001 ./validate-e2e.sh
#
# Variáveis de ambiente:
#   BASE_URL        URL base da Central (default: http://localhost:3000)
#   COMPANY_TOKEN   Token mobile da empresa (default: CMP-SILO-OPS-001)
#   OPERATOR_REG    Matrícula do operador (default: 1001)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${COMPANY_TOKEN:-CMP-SILO-OPS-001}"
OP_REG="${OPERATOR_REG:-1001}"
COOKIE_JAR="/tmp/silo_e2e_cookies.txt"
LOG_DIR="/tmp/silo_e2e_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOG_DIR"

# ── cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "${GREEN}  ✓ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} — $1"; ((FAIL++)); }
info() { echo -e "${BLUE}  ·${NC} $1"; }
section() { echo -e "\n${YELLOW}══ $1 ══${NC}"; }

# ── helpers ──────────────────────────────────────────────────────────────────
get() {
  curl -si --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    -H "Accept: application/json" "$@"
}
post() {
  local url="$1"; shift
  curl -si --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    -X POST -H "Content-Type: application/json" -H "Accept: application/json" "$@" "$url"
}
patch() {
  local url="$1"; shift
  curl -si --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    -X PATCH -H "Content-Type: application/json" -H "Accept: application/json" "$@" "$url"
}
http_status() { head -1 | grep -oP '\d{3}' | head -1; }
body_json()   { sed '1,/^\r$/d'; }
field()       { python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1','MISSING'))" 2>/dev/null || echo "PARSE_ERROR"; }

# ── CSRF: obter token ─────────────────────────────────────────────────────────
get_csrf() {
  local resp
  resp=$(get "$BASE_URL/api/auth/me" 2>/dev/null || true)
  echo "$resp" | grep -oP "(?<=silo_csrf=)[^;]+" | head -1
}

# ══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BLUE}SILO OPS — Validação E2E${NC}  $(date)"
echo "BASE_URL: $BASE_URL"
echo "TOKEN:    $TOKEN"
echo "LOG_DIR:  $LOG_DIR"

# ─────────────────────────────────────────────────────────────────────────────
section "0. Health check"
resp=$(get "$BASE_URL/api/mobile/health" 2>/dev/null)
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/health.txt"
[ "$status" = "200" ] && pass "GET /api/mobile/health → 200" || fail "GET /api/mobile/health → $status (esperado 200)"

# ─────────────────────────────────────────────────────────────────────────────
section "1. Bootstrap — autenticação"

# 1a. Sem token → 401
resp=$(get "$BASE_URL/api/mobile/bootstrap")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/bootstrap_noauth.txt"
[ "$status" = "401" ] && pass "Bootstrap sem token → 401" || fail "Bootstrap sem token → $status (esperado 401)"

# 1b. Token inválido → 403
resp=$(get "$BASE_URL/api/mobile/bootstrap" -H "X-Company-Token: TOKEN-INVALIDO-XYZW")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/bootstrap_badtoken.txt"
[ "$status" = "403" ] && pass "Bootstrap token inválido → 403" || fail "Bootstrap token inválido → $status (esperado 403)"

# 1c. Token válido → 200
resp=$(get "$BASE_URL/api/mobile/bootstrap" \
  -H "X-Company-Token: $TOKEN" \
  -H "X-Operator-Id: $OP_REG")
status=$(echo "$resp" | http_status)
body=$(echo "$resp" | body_json)
echo "$resp" > "$LOG_DIR/bootstrap_ok.txt"
echo "$body" | python3 -m json.tool > "$LOG_DIR/bootstrap_ok_pretty.json" 2>/dev/null || true

[ "$status" = "200" ] && pass "Bootstrap com token válido → 200" || fail "Bootstrap → $status (esperado 200)"

# Verificar campos obrigatórios no payload
for field in tenantId version operator equipments workOrders costCenters implements operations stopReasons; do
  val=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$field'); print('ok' if v is not None else 'missing')" 2>/dev/null || echo "parse_error")
  [ "$val" = "ok" ] && pass "Bootstrap.${field} presente" || fail "Bootstrap.${field} ausente"
done

# Verificar passwordHash NÃO vaza no operador
ph=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); op=d.get('operator',{}); print(op.get('passwordHash','NOT_PRESENT'))" 2>/dev/null || echo "NOT_PRESENT")
[ "$ph" = "NOT_PRESENT" ] && pass "Bootstrap: passwordHash não exposto no operador" || fail "Bootstrap: passwordHash VAZANDO no operador → '$ph'"

# Salvar dados para próximos testes
EQUIP_ID=$(echo "$body" | python3 -c "import sys,json; items=json.load(sys.stdin).get('equipments',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
WO_ID=$(echo "$body"    | python3 -c "import sys,json; items=json.load(sys.stdin).get('workOrders',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
CC_ID=$(echo "$body"    | python3 -c "import sys,json; items=json.load(sys.stdin).get('costCenters',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
OP_ID=$(echo "$body"    | python3 -c "import sys,json; items=json.load(sys.stdin).get('operations',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
IMPL_ID=$(echo "$body"  | python3 -c "import sys,json; items=json.load(sys.stdin).get('implements',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")

info "Dados extraídos: equipamento=$EQUIP_ID, OS=$WO_ID, CC=$CC_ID, operação=$OP_ID, implemento=$IMPL_ID"

# ─────────────────────────────────────────────────────────────────────────────
section "2. Journeys/start — validações"

OP_STORAGE_ID=$(get "$BASE_URL/api/mobile/bootstrap" -H "X-Company-Token: $TOKEN" -H "X-Operator-Id: $OP_REG" \
  | body_json | python3 -c "import sys,json; d=json.load(sys.stdin); op=d.get('operator',{}); print(op.get('id',''))" 2>/dev/null || echo "op-1")

START_BODY=$(cat <<JSON
{
  "operatorId":     "$OP_STORAGE_ID",
  "equipmentId":   "$EQUIP_ID",
  "workOrderId":   "$WO_ID",
  "costCenterId":  "$CC_ID",
  "operationId":   "$OP_ID",
  "implementId":   "$IMPL_ID",
  "hourmeterStart": 4891,
  "startedAt":     "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "offlineId":     "e2e-test-$(date +%s)"
}
JSON
)

# 2a. Sem token → 401
resp=$(post "$BASE_URL/api/mobile/journeys/start" -d "$START_BODY")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/journey_noauth.txt"
[ "$status" = "401" ] && pass "Journey sem token → 401" || fail "Journey sem token → $status (esperado 401)"

# 2b. Campos obrigatórios ausentes → 400
resp=$(post "$BASE_URL/api/mobile/journeys/start" \
  -H "X-Company-Token: $TOKEN" \
  -d '{"equipmentId":"e-1"}')
status=$(echo "$resp" | http_status)
body=$(echo "$resp" | body_json)
echo "$resp" > "$LOG_DIR/journey_missing_fields.txt"
[ "$status" = "400" ] && pass "Journey campos ausentes → 400" || fail "Journey campos ausentes → $status (esperado 400)"
err_msg=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
info "Mensagem de erro: $err_msg"

# 2c. OS inexistente → 404
resp=$(post "$BASE_URL/api/mobile/journeys/start" \
  -H "X-Company-Token: $TOKEN" \
  -d "{\"operatorId\":\"$OP_STORAGE_ID\",\"equipmentId\":\"$EQUIP_ID\",\"workOrderId\":\"OS-INEXISTENTE-999\",\"costCenterId\":\"$CC_ID\",\"operationId\":\"$OP_ID\"}")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/journey_bad_wo.txt"
[ "$status" = "404" ] && pass "Journey OS inexistente → 404" || fail "Journey OS inexistente → $status (esperado 404)"

# 2d. Jornada válida → 200
resp=$(post "$BASE_URL/api/mobile/journeys/start" \
  -H "X-Company-Token: $TOKEN" \
  -d "$START_BODY")
status=$(echo "$resp" | http_status)
body=$(echo "$resp" | body_json)
echo "$resp" > "$LOG_DIR/journey_ok.txt"
echo "$body" | python3 -m json.tool > "$LOG_DIR/journey_ok_pretty.json" 2>/dev/null || true
[ "$status" = "200" ] && pass "Journey válida → 200" || fail "Journey → $status (esperado 200)"

JOURNEY_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('journeyId',''))" 2>/dev/null || echo "")
for f in success journeyId equipmentCode operatorName workOrderCode costCenterCode operationType; do
  val=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$f'); print('ok' if v is not None else 'missing')" 2>/dev/null || echo "parse_error")
  [ "$val" = "ok" ] && pass "Journey response.$f presente" || fail "Journey response.$f ausente"
done

# 2e. Jornada duplicada → 409
resp=$(post "$BASE_URL/api/mobile/journeys/start" \
  -H "X-Company-Token: $TOKEN" \
  -d "$START_BODY")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/journey_duplicate.txt"
[ "$status" = "409" ] && pass "Journey duplicada → 409 (bloqueio correto)" || fail "Journey duplicada → $status (esperado 409)"

# ─────────────────────────────────────────────────────────────────────────────
section "3. Ordens de Serviço — CRUD Central"

# Login web para obter sessão + CSRF
info "Fazendo login web..."
login_resp=$(post "$BASE_URL/api/auth/login" \
  -d '{"email":"admin@siloops.com","password":"admin123"}' 2>/dev/null || true)
login_status=$(echo "$login_resp" | http_status)
[ "$login_status" = "200" ] && pass "Login web → 200" || { fail "Login web → $login_status"; info "Verifique as credenciais em INITIAL_USERS"; }

CSRF=$(cat "$COOKIE_JAR" 2>/dev/null | grep silo_csrf | awk '{print $7}' | tail -1)
info "CSRF token: ${CSRF:0:8}…"

# GET ordens-servico
resp=$(get "$BASE_URL/api/ordens-servico?status=ABERTA")
status=$(echo "$resp" | http_status)
echo "$resp" > "$LOG_DIR/os_list.txt"
[ "$status" = "200" ] && pass "GET /api/ordens-servico?status=ABERTA → 200" || fail "GET ordens-servico → $status"

# PATCH → EM_ANDAMENTO (requer OS_ID real)
if [ -n "$WO_ID" ] && [ -n "$CSRF" ]; then
  resp=$(patch "$BASE_URL/api/ordens-servico/$WO_ID" \
    -H "X-CSRF-Token: $CSRF" \
    -d '{"status":"EM_ANDAMENTO"}')
  status=$(echo "$resp" | http_status)
  echo "$resp" > "$LOG_DIR/os_patch_em_andamento.txt"
  [ "$status" = "200" ] && pass "PATCH OS → EM_ANDAMENTO → 200" || fail "PATCH OS → $status"

  # Transição inválida: EM_ANDAMENTO → ABERTA deve dar 409
  resp=$(patch "$BASE_URL/api/ordens-servico/$WO_ID" \
    -H "X-CSRF-Token: $CSRF" \
    -d '{"status":"ABERTA"}')
  status=$(echo "$resp" | http_status)
  echo "$resp" > "$LOG_DIR/os_patch_invalid.txt"
  [ "$status" = "409" ] && pass "Transição inválida EM_ANDAMENTO→ABERTA → 409" || fail "Transição inválida → $status (esperado 409)"
else
  info "Pulando PATCH — CSRF ou WO_ID não disponível"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "4. Segurança"

# health/full sem auth → 401
resp=$(get "$BASE_URL/api/health/full")
status=$(echo "$resp" | http_status)
[ "$status" = "401" ] \
  && pass "GET /api/health/full sem auth → 401 (guard funciona)" \
  || fail "GET /api/health/full sem auth → $status (esperado 401 — VULNERABILIDADE)"

# Cross-tenant injection (header x-tenant-id diferente deve ser ignorado)
resp=$(get "$BASE_URL/api/ordens-servico" -H "X-Tenant-Id: tenant-atacante-999")
status=$(echo "$resp" | http_status)
[ "$status" = "401" ] || [ "$status" = "403" ] \
  && pass "Cross-tenant injection → $status (bloqueado)" \
  || fail "Cross-tenant injection → $status (esperado 401/403)"

# ─────────────────────────────────────────────────────────────────────────────
section "Resultado"
TOTAL=$((PASS + FAIL))
echo ""
echo "  Total: $TOTAL   Passou: $PASS   Falhou: $FAIL"
echo "  Logs em: $LOG_DIR/"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}✓ TODOS OS TESTES PASSARAM${NC}"
  exit 0
else
  echo -e "  ${RED}✗ $FAIL TESTE(S) FALHARAM — revisar logs em $LOG_DIR/${NC}"
  exit 1
fi
