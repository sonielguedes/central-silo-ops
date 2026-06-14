#!/bin/bash
# =============================================================================
# SILO OPS — Simulação APK: Jornada com Horímetro Limpo (P0 Validation)
# =============================================================================
# Simula o fluxo completo que o APK executa:
#   JOURNEY_START → HEARTBEAT → JOURNEY_END
# Permite validar o backend sem hardware físico.
#
# USO:
#   chmod +x test-hourmeter-journey.sh
#   ./test-hourmeter-journey.sh [FLEET_CODE] [HOURMETER_START] [HOURMETER_END]
#
# Exemplos:
#   ./test-hourmeter-journey.sh 1002 88 89     # emulador
#   ./test-hourmeter-journey.sh 1000 88 88     # celular real
# =============================================================================

set -e

# ── Configuração ──────────────────────────────────────────────────────────────
BASE_URL="${SILO_BASE_URL:-https://api.siloops.com.br}"
COMPANY_TOKEN="${SILO_COMPANY_TOKEN:-CMP-SILO-OPS-001}"
MACHINE_ID="${1:-1002}"          # ID interno do equipamento (machineId = equipmentId)
FLEET_CODE="${FLEET_CODE:-$MACHINE_ID}"
HOURMETER_START="${2:-88}"
HOURMETER_END="${3:-89}"
MOBILE_TOKEN="${SILO_MOBILE_TOKEN:-}"  # definir se necessário
JOURNEY_ID="journey-test-$(date +%s)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAILURES=$((FAILURES+1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

FAILURES=0

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  SILO OPS — P0 Horímetro Limpo — Simulação APK"
echo "  URL:       $BASE_URL"
echo "  MachineId: $MACHINE_ID  |  FleetCode: $FLEET_CODE"
echo "  Horímetro: start=$HOURMETER_START  end=$HOURMETER_END"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Verificar dependências ────────────────────────────────────────────────────
for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Instale $cmd primeiro"; exit 1; }
done

# ── Função: chamar batch ──────────────────────────────────────────────────────
call_batch() {
  local payload="$1"
  curl -s -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/mobile/events/batch" \
    -H "Content-Type: application/json" \
    -H "X-Company-Token: $COMPANY_TOKEN" \
    --data "$payload"
}

# ── Função: verificar status ──────────────────────────────────────────────────
get_fleet_status() {
  curl -s "$BASE_URL/api/equipamentos/status" \
    | jq --arg fc "$FLEET_CODE" '.[] | select(.fleetCode == $fc)'
}

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 0 — Verificar estado inicial (deve estar limpo)
# ══════════════════════════════════════════════════════════════════════════════
log "ETAPA 0 — Verificando estado inicial do live-state..."

INITIAL=$(curl -s "$BASE_URL/api/equipamentos/status" \
  | jq --arg fc "$FLEET_CODE" '.[] | select(.fleetCode == $fc) | {hourmeterStart, hourmeterCurrent}')

echo "Estado inicial: $INITIAL"

START_ZERO=$(echo "$INITIAL" | jq '.hourmeterStart == 0')
CURR_ZERO=$(echo "$INITIAL" | jq '.hourmeterCurrent == 0')

if [ "$START_ZERO" = "true" ] || [ "$CURR_ZERO" = "true" ]; then
  fail "ESTADO INICIAL JÁ CONTÉM hourmeterStart=0 ou hourmeterCurrent=0 — saneamento não aplicado!"
  echo "  → Execute: curl -s '$BASE_URL/api/equipamentos/status' para inspecionar"
  exit 1
else
  ok "Estado inicial limpo (sem zeros)"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 1 — JOURNEY_START com horímetro=88
# ══════════════════════════════════════════════════════════════════════════════
log "ETAPA 1 — Enviando JOURNEY_START (hourmeterStart=$HOURMETER_START, source=MANUAL)..."

TS_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UUID_START="uuid-journey-start-$(date +%s)"

PAYLOAD_START=$(cat <<EOF
{
  "header": {
    "machineId": "$MACHINE_ID",
    "fleetCode": "$FLEET_CODE",
    "mobileToken": "$MOBILE_TOKEN"
  },
  "events": [
    {
      "uuid": "$UUID_START",
      "type": "JOURNEY_START",
      "timestamp": "$TS_START",
      "data": {
        "fleetCode": "$FLEET_CODE",
        "mobileToken": "$MOBILE_TOKEN",
        "hourmeterStart": $HOURMETER_START,
        "hourmeterCurrent": $HOURMETER_START,
        "hourmeterSource": "MANUAL",
        "journeyId": "$JOURNEY_ID",
        "operatorRegistration": "OP-TEST-001",
        "operatorName": "Operador Teste"
      }
    }
  ]
}
EOF
)

RESPONSE_START=$(call_batch "$PAYLOAD_START")
HTTP_CODE_START=$(echo "$RESPONSE_START" | tail -1)
BODY_START=$(echo "$RESPONSE_START" | head -n -1)

echo "  HTTP: $HTTP_CODE_START"
echo "  Body: $BODY_START"

if [ "$HTTP_CODE_START" = "200" ]; then
  ok "[SyncRepository] HTTP=200 — JOURNEY_START sincronizado"
else
  fail "JOURNEY_START retornou HTTP=$HTTP_CODE_START"
fi

# Aguardar persistência
sleep 1

# Verificar live-state após JOURNEY_START
log "Verificando live-state após JOURNEY_START..."
STATUS_AFTER_START=$(get_fleet_status)
echo "$STATUS_AFTER_START" | jq '{fleetCode, status, hourmeterStart, hourmeterCurrent, hourmeterSource, hourmeterInconsistent}'

HS=$(echo "$STATUS_AFTER_START" | jq '.hourmeterStart // 0')
HC=$(echo "$STATUS_AFTER_START" | jq '.hourmeterCurrent // 0')
HSRC=$(echo "$STATUS_AFTER_START" | jq -r '.hourmeterSource // "missing"')
HINC=$(echo "$STATUS_AFTER_START" | jq '.hourmeterInconsistent // false')

if [ "$HS" = "$HOURMETER_START" ]; then
  ok "[Hourmeter] start=$HS ✓"
else
  fail "[Hourmeter] start esperado=$HOURMETER_START, recebido=$HS"
fi

if [ "$HC" -ge "$HOURMETER_START" ] 2>/dev/null; then
  ok "[Hourmeter] current=$HC >= start=$HOURMETER_START ✓"
else
  fail "[Hourmeter] current=$HC < start=$HOURMETER_START"
fi

if [ "$HSRC" = "MANUAL" ]; then
  ok "[Hourmeter] source=MANUAL ✓"
else
  fail "[Hourmeter] source esperado=MANUAL, recebido=$HSRC"
fi

if [ "$HINC" = "false" ] || [ "$HINC" = "null" ]; then
  ok "hourmeterInconsistent=null/false ✓"
else
  fail "hourmeterInconsistent=$HINC — dado inconsistente!"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 2 — HEARTBEAT com horímetro corrente
# ══════════════════════════════════════════════════════════════════════════════
log "ETAPA 2 — Enviando HEARTBEAT (hourmeterCurrent=$HOURMETER_START)..."

TS_HB=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UUID_HB="uuid-hb-$(date +%s)"

PAYLOAD_HB=$(cat <<EOF
{
  "header": {
    "machineId": "$MACHINE_ID",
    "fleetCode": "$FLEET_CODE",
    "mobileToken": "$MOBILE_TOKEN"
  },
  "events": [
    {
      "uuid": "$UUID_HB",
      "type": "HEARTBEAT",
      "timestamp": "$TS_HB",
      "data": {
        "fleetCode": "$FLEET_CODE",
        "mobileToken": "$MOBILE_TOKEN",
        "hourmeterCurrent": $HOURMETER_START,
        "hourmeterSource": "MANUAL",
        "latitude": -12.555,
        "longitude": -55.722,
        "speed": 4.5,
        "journeyId": "$JOURNEY_ID"
      }
    }
  ]
}
EOF
)

RESPONSE_HB=$(call_batch "$PAYLOAD_HB")
HTTP_CODE_HB=$(echo "$RESPONSE_HB" | tail -1)

if [ "$HTTP_CODE_HB" = "200" ]; then
  ok "HEARTBEAT HTTP=200 ✓"
else
  fail "HEARTBEAT retornou HTTP=$HTTP_CODE_HB"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 3 — Cenário Negativo: JOURNEY_END com end < start
# ══════════════════════════════════════════════════════════════════════════════
HOURMETER_INVALID=$((HOURMETER_START - 10))
log "ETAPA 3 — Cenário negativo: JOURNEY_END com end=$HOURMETER_INVALID (< start=$HOURMETER_START)..."

TS_END_NEG=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UUID_END_NEG="uuid-end-neg-$(date +%s)"

PAYLOAD_END_NEG=$(cat <<EOF
{
  "header": {
    "machineId": "$MACHINE_ID",
    "fleetCode": "$FLEET_CODE",
    "mobileToken": "$MOBILE_TOKEN"
  },
  "events": [
    {
      "uuid": "$UUID_END_NEG",
      "type": "JOURNEY_END",
      "timestamp": "$TS_END_NEG",
      "data": {
        "fleetCode": "$FLEET_CODE",
        "mobileToken": "$MOBILE_TOKEN",
        "hourmeterStart": $HOURMETER_START,
        "hourmeterEnd": $HOURMETER_INVALID,
        "totalHourmeter": -10,
        "hourmeterSource": "MANUAL",
        "journeyId": "$JOURNEY_ID"
      }
    }
  ]
}
EOF
)

RESPONSE_END_NEG=$(call_batch "$PAYLOAD_END_NEG")
HTTP_END_NEG=$(echo "$RESPONSE_END_NEG" | tail -1)

sleep 1
STATUS_NEG=$(get_fleet_status)
HINC_NEG=$(echo "$STATUS_NEG" | jq '.hourmeterInconsistent // false')
HEND_NEG=$(echo "$STATUS_NEG" | jq '.hourmeterEnd // "null"')

if [ "$HINC_NEG" = "true" ]; then
  ok "Backend marcou hourmeterInconsistent=true corretamente ✓"
else
  warn "hourmeterInconsistent=$HINC_NEG (esperado=true para end < start)"
fi

if [ "$HEND_NEG" = "null" ] || [ "$HEND_NEG" = "$HOURMETER_INVALID" ]; then
  if [ "$HEND_NEG" = "null" ]; then
    ok "hourmeterEnd=$HOURMETER_INVALID foi BLOQUEADO pelo backend ✓"
  else
    fail "hourmeterEnd inválido ($HOURMETER_INVALID) foi salvo pelo backend!"
  fi
fi

# Resetar inconsistência simulando nova jornada (opcional — não enviar em prod real)
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 4 — JOURNEY_END válido
# ══════════════════════════════════════════════════════════════════════════════
log "ETAPA 4 — JOURNEY_END válido (hourmeterEnd=$HOURMETER_END)..."

TOTAL_HM=$((HOURMETER_END - HOURMETER_START))
TS_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UUID_END="uuid-end-valid-$(date +%s)"

PAYLOAD_END=$(cat <<EOF
{
  "header": {
    "machineId": "$MACHINE_ID",
    "fleetCode": "$FLEET_CODE",
    "mobileToken": "$MOBILE_TOKEN"
  },
  "events": [
    {
      "uuid": "$UUID_END",
      "type": "JOURNEY_END",
      "timestamp": "$TS_END",
      "data": {
        "fleetCode": "$FLEET_CODE",
        "mobileToken": "$MOBILE_TOKEN",
        "hourmeterStart": $HOURMETER_START,
        "hourmeterEnd": $HOURMETER_END,
        "totalHourmeter": $TOTAL_HM,
        "hourmeterSource": "MANUAL",
        "journeyId": "$JOURNEY_ID"
      }
    }
  ]
}
EOF
)

RESPONSE_END=$(call_batch "$PAYLOAD_END")
HTTP_CODE_END=$(echo "$RESPONSE_END" | tail -1)
BODY_END=$(echo "$RESPONSE_END" | head -n -1)

echo "  HTTP: $HTTP_CODE_END"

if [ "$HTTP_CODE_END" = "200" ]; then
  ok "JOURNEY_END HTTP=200 ✓"
else
  fail "JOURNEY_END retornou HTTP=$HTTP_CODE_END"
fi

sleep 1

# ══════════════════════════════════════════════════════════════════════════════
# ETAPA 5 — Verificação Final (curl da Central)
# ══════════════════════════════════════════════════════════════════════════════
log "ETAPA 5 — Verificação final da API..."

STATUS_FINAL=$(get_fleet_status)
echo ""
echo "$STATUS_FINAL" | jq '{fleetCode, status, hourmeterStart, hourmeterCurrent, hourmeterEnd, totalHourmeter, hourmeterSource, hourmeterInconsistent, hourmeterInconsistencyReason}'
echo ""

HS_FINAL=$(echo "$STATUS_FINAL"  | jq '.hourmeterStart // 0')
HE_FINAL=$(echo "$STATUS_FINAL"  | jq '.hourmeterEnd // 0')
HT_FINAL=$(echo "$STATUS_FINAL"  | jq '.totalHourmeter // -1')
HSRC_FINAL=$(echo "$STATUS_FINAL" | jq -r '.hourmeterSource // "missing"')
HINC_FINAL=$(echo "$STATUS_FINAL" | jq '.hourmeterInconsistent // false')

[ "$HS_FINAL"   = "$HOURMETER_START" ] && ok "hourmeterStart=$HS_FINAL ✓"     || fail "hourmeterStart=$HS_FINAL (esperado=$HOURMETER_START)"
[ "$HE_FINAL"   = "$HOURMETER_END"   ] && ok "hourmeterEnd=$HE_FINAL ✓"       || fail "hourmeterEnd=$HE_FINAL (esperado=$HOURMETER_END)"
[ "$HT_FINAL"   = "$TOTAL_HM"        ] && ok "totalHourmeter=$HT_FINAL ✓"     || fail "totalHourmeter=$HT_FINAL (esperado=$TOTAL_HM)"
[ "$HSRC_FINAL" = "MANUAL"           ] && ok "hourmeterSource=MANUAL ✓"        || fail "hourmeterSource=$HSRC_FINAL (esperado=MANUAL)"
[ "$HINC_FINAL" = "false" ] || [ "$HINC_FINAL" = "null" ] \
  && ok "hourmeterInconsistent=null/false ✓" \
  || fail "hourmeterInconsistent=$HINC_FINAL — inconsistência detectada!"

# Verificar que nenhum campo retornou zero
ZERO_CHECK=$(echo "$STATUS_FINAL" | jq '
  (.hourmeterStart   == 0) or
  (.hourmeterCurrent == 0) or
  (.hourmeterEnd     == 0)
')
[ "$ZERO_CHECK" = "false" ] && ok "Nenhum campo de horímetro com valor 0 ✓" || fail "Campo de horímetro com valor 0 detectado!"

# ══════════════════════════════════════════════════════════════════════════════
# RESULTADO FINAL
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "  ${GREEN}✅ P0 APROVADO — Horímetro limpo e consistente${NC}"
else
  echo -e "  ${RED}❌ P0 REPROVADO — $FAILURES falha(s) detectada(s)${NC}"
fi
echo "════════════════════════════════════════════════════════════"
echo ""

exit $FAILURES
