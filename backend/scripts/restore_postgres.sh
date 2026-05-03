#!/usr/bin/env bash
# Restore from a backup (used for the weekly restore drill).
# DESTRUCTIVE — runs against TARGET_DATABASE_URL, NOT the live DATABASE_URL.
set -euo pipefail

: "${TARGET_DATABASE_URL:?missing — point this at a fresh sandbox database}"
: "${BACKUP_S3_URI:?e.g. s3://mwrd-backups/mwrd-backups/mwrd-...sql.gz}"

tmp="/tmp/restore.sql.gz"
aws s3 cp "${BACKUP_S3_URI}" "${tmp}" --only-show-errors
gunzip -c "${tmp}" | psql "${TARGET_DATABASE_URL}" --single-transaction
rm -f "${tmp}"
echo "[restore] OK"
