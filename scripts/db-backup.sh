#!/usr/bin/env bash
#
# SQLite Database Backup Script
# Creates timestamped snapshots in /backups (or custom dir).
# Retains the last N backups (default: 7).
#
# Usage:
#   ./scripts/db-backup.sh                      # Uses defaults
#   ./scripts/db-backup.sh /path/to/db 10       # Custom DB path + retention
#   BACKUP_DIR=/mnt/backups ./scripts/db-backup.sh
#

set -euo pipefail

DB_PATH="${1:-${DATABASE_PATH:-./mission-control.db}}"
RETENTION="${2:-7}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mission-control_${TIMESTAMP}.db"

# Verify source database exists
if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at ${DB_PATH}"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Checkpoint WAL to ensure all data is in main db file
echo "Checkpointing WAL..."
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

# Use SQLite .backup for a safe online snapshot
echo "Creating backup: ${BACKUP_FILE}"
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Verify backup integrity
echo "Verifying backup integrity..."
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" != "ok" ]; then
  echo "WARNING: Backup integrity check failed: ${INTEGRITY}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Rotate: remove old backups beyond retention
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/mission-control_*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$RETENTION" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - RETENTION))
  echo "Rotating: removing ${REMOVE_COUNT} old backup(s) (keeping ${RETENTION})"
  ls -1t "${BACKUP_DIR}"/mission-control_*.db | tail -n "$REMOVE_COUNT" | xargs rm -f
fi

echo "Done. Total backups: $(ls -1 "${BACKUP_DIR}"/mission-control_*.db 2>/dev/null | wc -l | tr -d ' ')"
