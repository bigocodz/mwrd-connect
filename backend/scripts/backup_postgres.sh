#!/usr/bin/env bash
# Nightly Postgres backup → S3 (or any S3-compatible bucket).
#
# Required env:
#   DATABASE_URL          postgres://user:pass@host:5432/dbname
#   BACKUP_BUCKET         e.g. mwrd-backups
#   AWS_REGION            e.g. me-south-1
#
# Optional:
#   BACKUP_PREFIX         default: mwrd-backups/
#   BACKUP_RETENTION_DAYS default: 30 (lifecycle on the bucket is preferred)
#
# Usage (cron, ECS Scheduled Task, or `docker compose run`):
#   ./scripts/backup_postgres.sh
set -euo pipefail

: "${DATABASE_URL:?missing}"
: "${BACKUP_BUCKET:?missing}"
: "${AWS_REGION:?missing}"
PREFIX="${BACKUP_PREFIX:-mwrd-backups/}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
file="mwrd-${ts}.sql.gz"
out="/tmp/${file}"

echo "[backup] dumping → ${out}"
pg_dump "${DATABASE_URL}" --no-owner --no-privileges --format=plain | gzip -9 > "${out}"

size_bytes=$(wc -c < "${out}" | tr -d ' ')
echo "[backup] dump size: ${size_bytes} bytes"

if [ "${size_bytes}" -lt 1000 ]; then
  echo "[backup] dump suspiciously small — refusing to upload" >&2
  exit 1
fi

echo "[backup] uploading → s3://${BACKUP_BUCKET}/${PREFIX}${file}"
aws s3 cp "${out}" "s3://${BACKUP_BUCKET}/${PREFIX}${file}" \
  --region "${AWS_REGION}" --only-show-errors

rm -f "${out}"
echo "[backup] done"
