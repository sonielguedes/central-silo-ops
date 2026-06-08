#!/usr/bin/env bash
# ──────────────────────────────────────────────
# SILO OPS Central — Backup Script (Multi-Tenant)
# Backs up data/ (all tenants or specific tenant)
# Usage:
#   ./scripts/backup-data.sh              # backup all tenants
#   ./scripts/backup-data.sh --tenant ID  # backup specific tenant
#   ./scripts/backup-data.sh --dest DIR   # custom destination
# ──────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEST_DIR="$PROJECT_ROOT/backups"
TENANT=""
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant) TENANT="$2"; shift 2 ;;
    --dest)   DEST_DIR="$2"; shift 2 ;;
    *)        echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║   SILO OPS Central — Backup         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Project root : $PROJECT_ROOT"
echo "Destination  : $DEST_DIR"
echo "Tenant       : ${TENANT:-ALL}"
echo ""

mkdir -p "$DEST_DIR"

if [ -n "$TENANT" ]; then
  # ── Single tenant backup ─────────────────────────────────────────────
  TENANT_DIR="$PROJECT_ROOT/data/$TENANT"
  if [ ! -d "$TENANT_DIR" ]; then
    echo "✗ Tenant directory not found: $TENANT_DIR"
    exit 1
  fi

  BACKUP_FILE="siloops-tenant-${TENANT}-${TIMESTAMP}.tar.gz"
  echo "Backing up tenant: $TENANT"
  cd "$PROJECT_ROOT"
  tar -czf "$DEST_DIR/$BACKUP_FILE" "data/$TENANT"

  SIZE=$(du -h "$DEST_DIR/$BACKUP_FILE" | cut -f1)
  echo "✓ Tenant backup: $DEST_DIR/$BACKUP_FILE ($SIZE)"

  # Keep last 10 per tenant
  TENANT_BACKUPS=$(ls -1 "$DEST_DIR"/siloops-tenant-"${TENANT}"-*.tar.gz 2>/dev/null | wc -l)
  if [ "$TENANT_BACKUPS" -gt 10 ]; then
    REMOVE=$((TENANT_BACKUPS - 10))
    echo "Cleaning $REMOVE old tenant backup(s)..."
    ls -1t "$DEST_DIR"/siloops-tenant-"${TENANT}"-*.tar.gz | tail -n "$REMOVE" | xargs rm -f
  fi
else
  # ── Full backup (all tenants) ────────────────────────────────────────
  ITEMS=()

  if [ -d "$PROJECT_ROOT/data" ]; then
    ITEMS+=("data")
    # List tenants
    TENANT_COUNT=$(find "$PROJECT_ROOT/data" -mindepth 1 -maxdepth 1 -type d | wc -l)
    echo "✓ data/ found — $TENANT_COUNT tenant(s)"
    find "$PROJECT_ROOT/data" -mindepth 1 -maxdepth 1 -type d -printf "  → %f\n" 2>/dev/null || true
  else
    echo "⚠ data/ not found — skipping"
  fi

  if [ -f "$PROJECT_ROOT/.env.production" ]; then
    ITEMS+=(".env.production")
    echo "✓ .env.production found"
  fi

  if [ ${#ITEMS[@]} -eq 0 ]; then
    echo "✗ Nothing to backup. Exiting."
    exit 1
  fi

  BACKUP_FILE="siloops-data-${TIMESTAMP}.tar.gz"
  echo ""
  echo "Creating archive..."
  cd "$PROJECT_ROOT"
  tar -czf "$DEST_DIR/$BACKUP_FILE" "${ITEMS[@]}"

  SIZE=$(du -h "$DEST_DIR/$BACKUP_FILE" | cut -f1)
  echo "✓ Full backup: $DEST_DIR/$BACKUP_FILE ($SIZE)"

  # Keep last 10
  FULL_COUNT=$(ls -1 "$DEST_DIR"/siloops-data-*.tar.gz 2>/dev/null | wc -l)
  if [ "$FULL_COUNT" -gt 10 ]; then
    REMOVE=$((FULL_COUNT - 10))
    echo "Cleaning $REMOVE old backup(s)..."
    ls -1t "$DEST_DIR"/siloops-data-*.tar.gz | tail -n "$REMOVE" | xargs rm -f
  fi

  # ── Per-tenant individual backups ──────────────────────────────────
  echo ""
  echo "Creating per-tenant backups..."
  for TDIR in "$PROJECT_ROOT"/data/*/; do
    [ -d "$TDIR" ] || continue
    T=$(basename "$TDIR")
    TFILE="siloops-tenant-${T}-${TIMESTAMP}.tar.gz"
    tar -czf "$DEST_DIR/$TFILE" "data/$T"
    TSIZE=$(du -h "$DEST_DIR/$TFILE" | cut -f1)
    echo "  ✓ $T → $TFILE ($TSIZE)"
  done
fi

echo ""
echo "✓ Backup complete."
