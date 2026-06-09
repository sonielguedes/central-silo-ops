#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_ROOT="${SILO_STORAGE_DIR:-${SILO_DATA_DIR:-$PROJECT_ROOT/data}}"
BACKUP_ROOT="${BACKUP_ROOT:-$PROJECT_ROOT/backups}"
DATA_PARENT="$(dirname "$DATA_ROOT")"
DATA_NAME="$(basename "$DATA_ROOT")"
KIND="daily"
TENANT=""
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-3}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/backup-data.sh [--kind daily|weekly|monthly] [--tenant TENANT_ID] [--dest DIR] [--data-root DIR]

Behavior:
  - Backs up full data/ plus .env.production when --tenant is not set.
  - Backs up a single tenant when --tenant is set.
  - Keeps 7 daily, 4 weekly and 3 monthly archives by default.
EOF
}

limit_for_kind() {
  case "$1" in
    daily) echo "$KEEP_DAILY" ;;
    weekly) echo "$KEEP_WEEKLY" ;;
    monthly) echo "$KEEP_MONTHLY" ;;
    *) echo "0" ;;
  esac
}

prune_archives() {
  local dir="$1"
  local pattern="$2"
  local keep="$3"
  local -a files=()

  mapfile -t files < <(
    find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@|%p\n' 2>/dev/null \
      | sort -rn \
      | cut -d'|' -f2-
  )

  if (( ${#files[@]} <= keep )); then
    return 0
  fi

  for ((i=keep; i<${#files[@]}; i++)); do
    rm -f -- "${files[$i]}"
  done
}

create_archive() {
  local output="$1"
  shift
  tar -czf "$output" "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind)
      KIND="${2:-}"
      shift 2
      ;;
    --tenant)
      TENANT="${2:-}"
      shift 2
      ;;
    --dest)
      BACKUP_ROOT="${2:-}"
      shift 2
      ;;
    --data-root)
      DATA_ROOT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$KIND" in
  daily|weekly|monthly) ;;
  *)
    echo "Invalid --kind: $KIND" >&2
    exit 1
    ;;
esac

if [[ ! -d "$DATA_ROOT" ]]; then
  echo "Data root not found: $DATA_ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT/$KIND/full" "$BACKUP_ROOT/$KIND/tenants"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LIMIT="$(limit_for_kind "$KIND")"

cd "$PROJECT_ROOT"

echo "[backup] root=$PROJECT_ROOT"
echo "[backup] data-root=$DATA_ROOT"
echo "[backup] backup-root=$BACKUP_ROOT"
echo "[backup] kind=$KIND"
echo "[backup] tenant=${TENANT:-ALL}"

if [[ -n "$TENANT" ]]; then
  if [[ ! -d "$DATA_ROOT/$TENANT" ]]; then
    echo "Tenant directory not found: $DATA_ROOT/$TENANT" >&2
    exit 1
  fi

  FILE="siloops-${KIND}-tenant-${TENANT}-${TIMESTAMP}.tar.gz"
  create_archive "$BACKUP_ROOT/$KIND/tenants/$FILE" -C "$DATA_ROOT" "$TENANT"

  SIZE="$(du -h "$BACKUP_ROOT/$KIND/tenants/$FILE" | cut -f1)"
  echo "[backup] tenant archive=$FILE size=$SIZE"

  prune_archives "$BACKUP_ROOT/$KIND/tenants" "siloops-${KIND}-tenant-${TENANT}-*.tar.gz" "$LIMIT"
else
  FILE="siloops-${KIND}-data-${TIMESTAMP}.tar.gz"
  if [[ -f ".env.production" ]]; then
    create_archive "$BACKUP_ROOT/$KIND/full/$FILE" -C "$DATA_PARENT" "$DATA_NAME" -C "$PROJECT_ROOT" ".env.production"
  else
    create_archive "$BACKUP_ROOT/$KIND/full/$FILE" -C "$DATA_PARENT" "$DATA_NAME"
  fi

  SIZE="$(du -h "$BACKUP_ROOT/$KIND/full/$FILE" | cut -f1)"
  echo "[backup] full archive=$FILE size=$SIZE"

  prune_archives "$BACKUP_ROOT/$KIND/full" "siloops-${KIND}-data-*.tar.gz" "$LIMIT"

  shopt -s nullglob
  for tenant_dir in "$DATA_ROOT"/*/; do
    tenant="$(basename "$tenant_dir")"
    tenant_file="siloops-${KIND}-tenant-${tenant}-${TIMESTAMP}.tar.gz"
    create_archive "$BACKUP_ROOT/$KIND/tenants/$tenant_file" -C "$DATA_ROOT" "$tenant"
    tenant_size="$(du -h "$BACKUP_ROOT/$KIND/tenants/$tenant_file" | cut -f1)"
    echo "[backup] tenant=$tenant archive=$tenant_file size=$tenant_size"
    prune_archives "$BACKUP_ROOT/$KIND/tenants" "siloops-${KIND}-tenant-${tenant}-*.tar.gz" "$LIMIT"
  done
  shopt -u nullglob
fi

echo "[backup] complete"
