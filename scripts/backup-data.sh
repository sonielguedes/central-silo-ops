#!/usr/bin/env bash
# ──────────────────────────────────────────────
# SILO OPS Central — Backup Script
# Backs up data/ and .env.production
# Usage: ./scripts/backup-data.sh [dest_dir]
# ──────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEST_DIR="${1:-$PROJECT_ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="siloops-data-${TIMESTAMP}.tar.gz"

echo "╔══════════════════════════════════════╗"
echo "║   SILO OPS Central — Backup         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Project root : $PROJECT_ROOT"
echo "Destination  : $DEST_DIR"
echo "Backup file  : $BACKUP_FILE"
echo ""

# Ensure destination exists
mkdir -p "$DEST_DIR"

# Build list of items to backup
ITEMS=()

if [ -d "$PROJECT_ROOT/data" ]; then
  ITEMS+=("data")
  echo "✓ data/ found — will backup"
else
  echo "⚠ data/ not found — skipping"
fi

if [ -f "$PROJECT_ROOT/.env.production" ]; then
  ITEMS+=(".env.production")
  echo "✓ .env.production found — will backup"
else
  echo "⚠ .env.production not found — skipping"
fi

if [ ${#ITEMS[@]} -eq 0 ]; then
  echo ""
  echo "✗ Nothing to backup. Exiting."
  exit 1
fi

echo ""
echo "Creating archive..."

cd "$PROJECT_ROOT"
tar -czf "$DEST_DIR/$BACKUP_FILE" "${ITEMS[@]}"

SIZE=$(du -h "$DEST_DIR/$BACKUP_FILE" | cut -f1)

echo ""
echo "✓ Backup complete: $DEST_DIR/$BACKUP_FILE ($SIZE)"
echo ""

# Cleanup old backups — keep last 10
BACKUP_COUNT=$(ls -1 "$DEST_DIR"/siloops-data-*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 10))
  echo "Cleaning up $REMOVE_COUNT old backup(s)..."
  ls -1t "$DEST_DIR"/siloops-data-*.tar.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
  echo "✓ Cleanup done — keeping last 10 backups"
fi
