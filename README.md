# MWRD Connect

B2B procurement marketplace. Clients post RFQs, suppliers bid, MWRD staff
moderate. KSA-localized (Wafeq accounting, Wathq CR registry, SPL national
address).

## Layout

```
backend/         Django 5 + DRF + Postgres + Celery + Redis (modular monolith)
frontend/       pnpm + Turborepo monorepo — 3 Vite apps + shared packages
.github/workflows/  CI: backend.yml, frontend.yml, deploy.yml
docs/PHASES.md  Phase-by-phase build log

convex/         ARCHIVED — old Convex backend (see convex/ARCHIVED.md)
src/            ARCHIVED — old single-bundle frontend (see src/ARCHIVED.md)
```

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Django 5 + DRF + drf-spectacular |
| DB | Postgres 16 |
| Background jobs | Celery + Redis (django-celery-beat for cron) |
| Storage | S3-compatible (MinIO in dev, AWS S3 / Cloudflare R2 in prod) |
| Email | Anymail + AWS SES (Mailhog in dev) |
| Frontend | Vite + React 19 + TypeScript |
| API client | `openapi-typescript` codegen from `/api/schema/` |
| Auth | JWT in httpOnly cookies + TOTP for staff |
| Observability | Structured JSON logs + Sentry |

## First-time setup

```bash
# 1. Backend
cd backend
brew install uv                                # one-time
cp .env.example .env
uv sync
docker compose up -d                           # postgres + redis + minio + mailhog
uv run python manage.py migrate
uv run python manage.py seed_staff \
    --email staff@mwrd.local --password 'ChangeMe' --enroll-totp
uv run python manage.py runserver 8001

# 2. Frontend (in a second terminal)
cd ../frontend
pnpm install
pnpm dev                                       # admin:5175 client:5173 supplier:5174
```

## Onboarding flow

Invite-only. MWRD staff create the org, the system emails the owner an
invite link, the owner sets a password and submits KYC docs, staff approves
KYC → org is `ACTIVE`. From there clients post RFQs and suppliers bid.

```bash
# Bootstrap a customer org from the CLI
uv run python manage.py seed_org \
    --type CLIENT --name 'Acme Co' --public-id ACME --email owner@acme.sa
```

## Tests

```bash
cd backend
uv run pytest -q                               # 86 tests, ~1.5s
uv run ruff check .
```

```bash
cd frontend
pnpm typecheck
pnpm build
```

## Deploy

See `backend/deploy/README.md`. CI workflow `.github/workflows/deploy.yml`
covers the AWS ECS Fargate path. Backups: `backend/scripts/backup_postgres.sh`
on a daily schedule, weekly verified restore via `restore_postgres.sh`.

## Phase log

See `docs/PHASES.md` for the full build journal (Phase 0 scaffolding →
Phase 9 cutover) plus the deferred-items list.
