# Deploy

## Production environment variables (.env)

Required:
```
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=<rotate via secrets manager>
ALLOWED_HOSTS=api.mwrd.com,admin.mwrd.com
DATABASE_URL=postgres://...                     # RDS / Neon
REDIS_URL=redis://...                           # ElastiCache / Upstash
CELERY_BROKER_URL=redis://...
CELERY_RESULT_BACKEND=redis://...
JWT_SIGNING_KEY=<≥32 chars, rotate annually>
COOKIE_DOMAIN=.mwrd.com
COOKIE_SECURE=True

# CORS — list every customer-facing portal origin
CORS_ALLOWED_ORIGINS=https://app.mwrd.com,https://suppliers.mwrd.com,https://admin.mwrd.com
CSRF_TRUSTED_ORIGINS=https://app.mwrd.com,https://suppliers.mwrd.com,https://admin.mwrd.com

# Storage
AWS_ACCESS_KEY_ID=...                           # or use IAM role
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=mwrd-prod
AWS_S3_REGION_NAME=me-south-1
# (no AWS_S3_ENDPOINT_URL in prod — uses real AWS)

# Email — Anymail with SES
EMAIL_BACKEND=anymail.backends.amazon_ses.EmailBackend
DEFAULT_FROM_EMAIL=no-reply@mwrd.com

# Frontend URLs (used in invite/email links)
FRONTEND_CLIENT_URL=https://app.mwrd.com
FRONTEND_SUPPLIER_URL=https://suppliers.mwrd.com
FRONTEND_ADMIN_URL=https://admin.mwrd.com

# Integration providers (flip to "http" once credentials are wired)
WAFEQ_PROVIDER=fake
WATHQ_PROVIDER=fake
SPL_PROVIDER=fake

# Observability
SENTRY_DSN=https://...                          # opt-in
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.05
```

## Deploy paths

### Option A — single VM (cheapest)
```bash
docker compose -f deploy/docker-compose.prod.yml up -d
```
Reverse-proxy with Caddy / Nginx for TLS. Backups via cron calling
`scripts/backup_postgres.sh`.

### Option B — AWS ECS Fargate (recommended once you have customers)
- Build image: see `.github/workflows/deploy.yml`
- Three services: `web`, `worker`, `beat` (and a one-shot `migrate` task on deploy)
- Postgres: RDS in private subnet, daily snapshots + PITR
- Redis: ElastiCache (single shard, multi-AZ for prod)
- Frontend: each Vite app builds to `dist/` → S3 + CloudFront
- Admin portal: WAF rule allowlisting office/VPN egress IPs

### Option C — Render / Fly (fastest to ship)
Map the three services to three Render Background Workers / Web Services.
Use the same image, different start commands.

## Backup drill (weekly)

```bash
# In the staging account
TARGET_DATABASE_URL=postgres://...staging \
BACKUP_S3_URI=s3://mwrd-backups/mwrd-backups/<latest>.sql.gz \
  ./scripts/restore_postgres.sh
```

If this fails, pause the next deploy until backups are healthy.

## Frontend deploy

Each Vite app is static once built. CI workflow `frontend.yml` builds all
three; copy `dist/` into the matching CloudFront origin bucket. The TS API
client (`packages/api/src/schema.ts`) must be regenerated against the
deployed backend's `/api/schema/` and committed before frontend deploy.
