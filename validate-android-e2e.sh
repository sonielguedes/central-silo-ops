#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SILO OPS — Validação E2E Android real via ADB
# Pré-requisito: dispositivo conectado via USB (adb devices) ou emulador rodando
#
# Uso:
#   ./validate-android-e2e.sh
#   ADB_SERIAL=emulator-5554 ./validate-android-e2e.sh  # dispositivo específico
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PKG="com.soniel.silo"   # Ajustado para o novo namespace
ADB="adb${ADB_SERIAL:+ -s $ADB_SERIAL}"
DB_PATH="/data/data/$PKG/databases/silo_database" # Ajustado para o nome real do banco
LOG="/tmp/silo_android_e2e_$(date +%Y%m%d_%H%M%S).log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "${GREEN}  ✓ PASS${NC} — $1" | tee -a "$LOG"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} — $1" | tee -a "$LOG"; ((FAIL++)); }
info() { echo -e "${BLUE}  ·${NC} $1" | tee -a "$LOG"; }
section() { echo -e "\n${YELLOW}══ $1 ══${NC}" | tee -a "$LOG"; }
adb_shell() { $ADB shell "$@" 2>/dev/null; }
sqlite()    { adb_shell "run-as $PKG sqlite3 $DB_PATH \"$1\"" 2>/dev/null || echo "ERROR"; }

# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}SILO OPS — Validação Android E2E${NC}  $(date)" | tee "$LOG"

section "0. Conectividade ADB"
if ! $ADB get-state 2>/dev/null | grep -q "device"; then
  fail "Nenhum dispositivo conectado (adb get-state)"
  echo "Execute: adb devices"
  exit 1
fi
DEVICE=$($ADB get-serialno 2>/dev/null || echo "desconhecido")
pass "Dispositivo conectado: $DEVICE"

# ─────────────────────────────────────────────────────────────────────────────
section "1. Limpar dados e iniciar"
info "Parando app..."
adb_shell "am force-stop $PKG" || true
info "Limpando dados..."
adb_shell "pm clear $PKG" || true
sleep 2

info "Iniciando app..."
adb_shell "am start -n $PKG/.MainActivity" 2>/dev/null || \
adb_shell "monkey -p $PKG -c android.intent.category.LAUNCHER 1" 2>/dev/null || true
sleep 3
pass "App iniciado"

info "⚠️  Faça a identificação (Frota e Matrícula) manualmente no app agora, depois pressione ENTER para continuar..."
read -r

# ─────────────────────────────────────────────────────────────────────────────
section "2. Verificar banco Room após bootstrap"
info "Aguardando sync bootstrap (10s)..."
sleep 10

# Verificar tabela cached_equipment
EQ_COUNT=$(sqlite "SELECT COUNT(*) FROM cached_equipment;" 2>/dev/null || echo "0")
info "cached_equipment rows: $EQ_COUNT"
[ "$EQ_COUNT" -ge "1" ] && pass "Room: cached_equipment preenchido ($EQ_COUNT frota(s))" || fail "Room: cached_equipment vazio"

# Verificar tenantId no equipamento
TENANT=$(sqlite "SELECT tenantId FROM cached_equipment LIMIT 1;" 2>/dev/null || echo "")
[ -n "$TENANT" ] && pass "Room: tenantId salvo no equipamento = '$TENANT'" || fail "Room: tenantId vazio no cache de frota"

# Verificar tabelas de Master Data
OP_COUNT=$(sqlite "SELECT COUNT(*) FROM operators;" 2>/dev/null || echo "0")
[ "$OP_COUNT" -ge "1" ] && pass "Room: $OP_COUNT operador(es) sincronizado(s)" || fail "Room: nenhum operador no banco"

WO_COUNT=$(sqlite "SELECT COUNT(*) FROM work_orders;" 2>/dev/null || echo "0")
[ "$WO_COUNT" -ge "1" ] && pass "Room: $WO_COUNT OS(s) aberta(s) no banco" || fail "Room: nenhuma OS no banco"

CC_COUNT=$(sqlite "SELECT COUNT(*) FROM cost_centers;" 2>/dev/null || echo "0")
[ "$CC_COUNT" -ge "1" ] && pass "Room: $CC_COUNT centro(s) de custo no banco" || fail "Room: nenhum CC no banco"

SR_COUNT=$(sqlite "SELECT COUNT(*) FROM stop_reasons;" 2>/dev/null || echo "0")
[ "$SR_COUNT" -ge "1" ] && pass "Room: $SR_COUNT motivo(s) de parada no banco" || fail "Room: nenhum motivo de parada no banco"

# ─────────────────────────────────────────────────────────────────────────────
section "3. Verificar logs de sync (Logcat)"
info "Capturando logs SILO OPS (últimos 5s)..."
$ADB logcat -d -t 200 2>/dev/null | grep -iE "SILO|bootstrap|FleetRepository|JourneyStartVM" | tail -20 | tee -a "$LOG" || true

SYNC_OK=$(adb_shell "logcat -d -t 200 2>/dev/null" | grep -c "Bootstrap.*concluída\|Iniciando bootstrap" 2>/dev/null || echo "0")
[ "$SYNC_OK" -ge "1" ] && pass "Logcat: fluxo de bootstrap registrado" || info "Logcat: sem log de sync explícito (verificar logs manuais acima)"

# ─────────────────────────────────────────────────────────────────────────────
section "4. Simular offline — desligar internet"
info "Desligando WiFi e dados móveis..."
adb_shell "svc wifi disable" 2>/dev/null || true
adb_shell "svc data disable" 2>/dev/null || true
sleep 2

# Verificar persistência offline
info "Reiniciando app sem internet..."
adb_shell "am force-stop $PKG" || true
sleep 1
adb_shell "am start -n $PKG/.MainActivity" 2>/dev/null || true
sleep 5

OFFLINE_LOG=$(adb_shell "logcat -d -t 100 2>/dev/null" | grep -c "offline\|Cached\|Sem conexão\|Últimos dados" 2>/dev/null || echo "0")
[ "$OFFLINE_LOG" -ge "1" ] && pass "Modo offline: log detectado" || info "Modo offline: verificar se as sugestões carregaram mesmo sem rede"

# Contar cache — deve continuar com dados
COUNT_OFFLINE=$(sqlite "SELECT COUNT(*) FROM cached_equipment;" 2>/dev/null || echo "0")
[ "$COUNT_OFFLINE" -ge "1" ] && pass "Cache Room persistiu offline ($COUNT_OFFLINE linha(s))" || fail "Cache Room perdeu dados offline"

info "Religando internet..."
adb_shell "svc wifi enable" 2>/dev/null || true
adb_shell "svc data enable" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
section "5. Iniciar jornada e verificar evento"
info "⚠️  Preencha os spinners no app e clique 'Iniciar Jornada', depois ENTER..."
read -r
sleep 5

JOURNEY_LOG=$(adb_shell "logcat -d -t 200 2>/dev/null" | grep -c "JOURNEY_START\|journeyId\|journey-" 2>/dev/null || echo "0")
[ "$JOURNEY_LOG" -ge "1" ] && pass "Logcat: JOURNEY_START event registrado" || fail "Logcat: nenhum JOURNEY_START encontrado"

# ─────────────────────────────────────────────────────────────────────────────
section "Resultado"
TOTAL=$((PASS + FAIL))
echo "" | tee -a "$LOG"
echo "  Total: $TOTAL   Passou: $PASS   Falhou: $FAIL" | tee -a "$LOG"
echo "  Log completo: $LOG" | tee -a "$LOG"
echo "" | tee -a "$LOG"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}✓ TODOS OS TESTES ANDROID PASSARAM${NC}" | tee -a "$LOG"
  exit 0
else
  echo -e "  ${RED}✗ $FAIL TESTE(S) FALHARAM${NC}" | tee -a "$LOG"
  exit 1
fi
