# MWRD Backend

Django 5 + DRF + Postgres + Celery + Redis. Modular monolith.

## Layout

```
config/                  Django project (settings, urls, celery, asgi/wsgi)
apps/
  core/                  base models, tenant scoping, perms, storage, pagination
  accounts/              custom user, JWT auth, separate staff login + MFA
  organizations/         Organization (CLIENT/SUPPLIER), Membership, Invite
  ops/                   staff-only endpoints (admin portal)
  ...domain apps to come (catalog, kyc, rfqs, quotes, orders, ...)
```

## Tenant scoping pattern (read this first)

- **Single-org content** (catalog, KYC docs, internal team data) inherits
  `apps.core.models.TenantScopedModel`. `Model.objects` auto-filters by the
  current org pulled from the JWT. `Model.all_objects` is the unscoped escape
  hatch — use only in staff endpoints, management commands, or Celery tasks.
- **Cross-org transactions** (RFQ, Quote, Order, Invoice) inherit a manager
  derived from `apps.core.managers.MultiTenantManager` with `tenancy_fields`
  set to the FK names that may match the current org (e.g.
  `("client_org", "supplier_org")`).
- **Platform-global data** (master products, categories) uses plain
  `models.Model` — no scoping.

`CurrentOrgMiddleware` reads the org from the request and sets a
`ContextVar`. Forgetting to set it returns an unscoped queryset, so combine
with `IsOrgMember` permission for defense in depth.

## Two role systems

- **Platform roles** (MWRD staff): `is_staff=True` on the User model. Auth via
  `/api/auth/staff/login` with mandatory TOTP. JWT carries `scope=staff`.
- **Org roles** (customers): `Membership.role` ∈ {OWNER, ADMIN, BUYER,
  APPROVER, VIEWER}. JWT carries `scope=customer`, `org_id`, `role`.

Admin portal endpoints use `IsStaffWithScope` (checks both `is_staff` AND the
token scope).

## First-time setup

```bash
cd backend
cp .env.example .env

# Install uv if needed: brew install uv
uv sync

# Bring up Postgres, Redis, MinIO, Mailhog
docker compose up -d

# DB
uv run python manage.py makemigrations accounts organizations
uv run python manage.py migrate

# Create a staff superuser, then enroll TOTP for them via Django admin
uv run python manage.py createsuperuser

# Run dev server
uv run python manage.py runserver

# In another terminal: Celery worker + beat
uv run celery -A config worker -l info
uv run celery -A config beat -l info
```

## Generating the OpenAPI schema for the frontend

```bash
uv run python manage.py spectacular --file schema.yml
# Frontend pulls from /api/schema/ at dev time and codegens types.
```

## Conventions

- Business logic lives in `apps/<app>/services.py`, not in views or models.
- Read queries live in `apps/<app>/selectors.py`.
- Views are thin: validate input → call service → serialize response.
- Tests in `apps/<app>/tests/`. Use factories from `factory_boy`.
- Migrations are part of the app, committed.
- Never log raw invite tokens, JWTs, passwords, or KYC docs.
