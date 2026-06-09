#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${LOG_DIR:-$PROJECT_ROOT/logs}"
DAYS="${DAYS:-30}"

if [[ ! -d "$LOG_DIR" ]]; then
  echo "[cleanup-logs] log dir not found: $LOG_DIR"
  exit 0
fi

echo "[cleanup-logs] dir=$LOG_DIR days=$DAYS"

mapfile -t files < <(
  find "$LOG_DIR" -type f \
    \( -name '*.log' -o -name '*.log.*' -o -name '*.out' -o -name '*.err' -o -name '*.tmp' \) \
    -mtime +"$DAYS" -print 2>/dev/null
)

if (( ${#files[@]} == 0 )); then
  echo "[cleanup-logs] nothing to remove"
  exit 0
fi

for file in "${files[@]}"; do
  rm -f -- "$file"
  echo "[cleanup-logs] removed $file"
done

echo "[cleanup-logs] complete removed=${#files[@]}"
