#!/usr/bin/env bash
# Install a daily cron job on the Supabase host to dump all app data to the NAS.
# Run on 192.168.0.146 (user john), not on the Mac.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-shared-supabase.sh"
LOG_DIR="${LOG_DIR:-$HOME/apps/exhibition/logs}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/nas/AppData/Backup}"
CRON_SCHEDULE="${CRON_SCHEDULE:-15 2 * * *}"
MARKER="# shared-supabase-backup"

if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "Backup script not found: $BACKUP_SCRIPT" >&2
  exit 1
fi
chmod +x "$BACKUP_SCRIPT"

if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "NAS Backup folder not mounted at $BACKUP_ROOT" >&2
  echo "Mount smb://192.168.0.142/AppData (share) so Backup is at $BACKUP_ROOT" >&2
  exit 1
fi

if [[ ! -w "$BACKUP_ROOT" ]]; then
  echo "Cannot write to $BACKUP_ROOT" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
touch "$BACKUP_ROOT/.write-test" && rm -f "$BACKUP_ROOT/.write-test"

CRON_LINE="${CRON_SCHEDULE} /bin/bash ${BACKUP_SCRIPT} >>${LOG_DIR}/backup-shared-supabase.log 2>&1 ${MARKER}"

existing="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$existing" | grep -v "${MARKER}" || true)"
printf '%s\n%s\n' "$filtered" "$CRON_LINE" | grep -v '^$' | crontab -

echo "→ Cron installed:"
crontab -l | grep "$MARKER"
echo "  log: ${LOG_DIR}/backup-shared-supabase.log"
echo "  dest: ${BACKUP_ROOT}/shared-supabase/"
echo "✓ Daily backup at 02:15 local time on this host"
