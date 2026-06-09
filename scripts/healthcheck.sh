#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health/full}"
CONTAINER_NAME="${CONTAINER_NAME:-silo-piloto-web}"
DATA_ROOT="${DATA_ROOT:-${SILO_STORAGE_DIR:-${SILO_DATA_DIR:-$PROJECT_ROOT/data}}}"
MIN_FREE_GB="${MIN_FREE_GB:-1}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"
SKIP_CONTAINER="${SKIP_CONTAINER:-0}"
TMP_BODY=""
TMP_WRITE=""

cleanup() {
  if [[ -n "$TMP_BODY" && -f "$TMP_BODY" ]]; then
    rm -f "$TMP_BODY"
  fi
  if [[ -n "$TMP_WRITE" && -f "$TMP_WRITE" ]]; then
    rm -f "$TMP_WRITE"
  fi
  return 0
}
trap cleanup EXIT

fail() {
  echo "[healthcheck] FAIL: $1" >&2
  exit 1
}

check_http() {
  TMP_BODY="$(mktemp)"
  local http_code
  http_code="$(curl -fsS --max-time "$TIMEOUT_SECONDS" -o "$TMP_BODY" -w '%{http_code}' "$HEALTH_URL" || true)"

  if [[ "$http_code" != "200" ]]; then
    fail "HTTP check failed: status=$http_code url=$HEALTH_URL"
  fi

  if ! grep -q '"status":"healthy"' "$TMP_BODY"; then
    fail "Health endpoint did not report healthy"
  fi
}

check_container() {
  [[ "$SKIP_CONTAINER" == "1" ]] && return 0

  if ! command -v docker >/dev/null 2>&1; then
    fail "docker not available"
  fi

  local running
  running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  if [[ "$running" != "true" ]]; then
    fail "container not running: $CONTAINER_NAME"
  fi
}

check_disk() {
  if [[ ! -d "$DATA_ROOT" ]]; then
    fail "data root not found: $DATA_ROOT"
  fi

  local free_kb free_gb
  free_kb="$(df -Pk "$DATA_ROOT" | awk 'NR==2 {print $4}')"
  free_gb=$((free_kb / 1024 / 1024))

  if (( free_gb < MIN_FREE_GB )); then
    fail "low disk space: ${free_gb}GB free, minimum ${MIN_FREE_GB}GB"
  fi
}

check_write() {
  TMP_WRITE="$(mktemp "$DATA_ROOT/.healthcheck.XXXXXX")"
  printf '%s\n' "$(date -Iseconds)" > "$TMP_WRITE"
  rm -f "$TMP_WRITE"
  TMP_WRITE=""
}

check_http
check_container
check_disk
check_write

echo "[healthcheck] OK url=$HEALTH_URL container=$CONTAINER_NAME dataRoot=$DATA_ROOT freeGb>=$MIN_FREE_GB"
exit 0
