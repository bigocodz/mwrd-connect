# Phase log

| Phase | Title | Tests at end |
|---|---|---|
| 0 | Foundation (scaffold, monorepo, CI, pre-commit) | — |
| 1 | Auth & tenancy (JWT cookies, staff TOTP, tenant scoping) | 16 |
| 2 | Org lifecycle + KYC (state machine, signed S3 uploads, review queue) | 35 |
| 3 | Catalog (categories, master products, supplier listings, addition requests, FTS) | 52 |
| 4 | RFQ → Quote → Contract → Order (the core flow + dual sign) | 58 |
| 5 | Fulfillment + invoicing + payments (DN/GRN, 3-way match, dual invoice rails) | 63 |
| 6 | Cross-cutting (audit log, polymorphic comments, in-app notifications, dashboards) | 73 |
| 7 | KSA integrations (Wafeq sync, Wathq CR lookup, SPL address resolve) | 81 |
| 8 | Production readiness (Sentry, throttling, backup, k6, prod compose, deploy WF, dataops) | 86 |
| 9 | Cutover (seed commands, archive markers, root README) | 86 |

## What ships in this monorepo

```
backend/
  config/                 Django project (settings/{base,dev,prod,test})
  apps/
    core/                 base models, tenant scoping, perms, storage, throttling
    accounts/             custom user, JWT cookie auth, staff TOTP, signup-from-invite
    organizations/        Org, Membership, Invite + state machine
    notifications/        Celery email tasks + in-app inbox + notify()
    kyc/                  submission + signed S3 uploads + staff review
    catalog/              Category tree, MasterProduct (FTS), SupplierProduct,
                          Bundle, ProductAdditionRequest
    rfqs/ quotes/ contracts/ orders/    the core transaction flow
    fulfillment/          DeliveryNote + GRN + 3-way match
    invoicing/            SupplierInvoice + ClientInvoice (with margin)
    payments/             Payment + Payout + statement
    audit/                AuditLog (GFK + JSONB) + record_event hooks
    comments/             polymorphic Comment thread, role-gated
    dashboards/           role-aware summary endpoint
    integrations/
      wafeq/              accounting platform sync (Fake/Http providers)
      wathq/              CR registry lookup
      spl/                national address lookup
    dataops/              per-org export zip + staff-only purge
    ops/                  staff-only org create + KYC review + management cmds
  scripts/                backup_postgres.sh + restore_postgres.sh
  loadtest/               k6.js + README
  deploy/                 docker-compose.prod.yml + README
  tests/                  86 tests, all green
frontend/
  apps/{admin,client,supplier}/   three Vite apps, deployed independently
  packages/{ui,auth,api,i18n,utils}/   shared, with @mwrd/api codegen
.github/workflows/
  backend.yml frontend.yml deploy.yml
```

## Deferred work (not blocking launch)

These were called out as we went. Listed here so the next dev can pick them up:

**Quality / polish**
- Real HTTP providers for Wafeq / Wathq / SPL once sandbox credentials land.
- PDF rendering of contracts, statements, invoices (WeasyPrint installed; need legal templates).
- Reviews app (post-order supplier ratings).
- Reports app (scheduled CSV exports per org).

**Performance / observability**
- ENUM_NAME_OVERRIDES in spectacular settings to clean up the `Status` enum collision.
- Realtime via Django Channels — currently 20s polling on the notification bell.
- Per-tenant query metrics tagged in Sentry transactions.

**Frontend**
- Image upload UI on master / supplier product / addition-request forms (signed-URL endpoint already exists; reuse the KYC wizard's pattern).
- Staff-side aggregator listing of supplier+client invoices (currently the admin panel asks the operator for ids).
- Bundle CRUD UI (admin service exists).
- Mobile responsive pass on every dashboard.

**Hardening**
- Rate-limit the staff TOTP enroll endpoints under heavier scopes.
- Per-org outbound webhook system (enterprise asks).
- Multi-org user switching for accountants who serve multiple clients.

## Cutover checklist

- [ ] `convex/` archived (see `convex/ARCHIVED.md`) — delete in a separate PR after ≥ 2 weeks live.
- [ ] `src/` archived (see `src/ARCHIVED.md`) — same window.
- [ ] DNS pointed at the new `app.mwrd.com / suppliers.mwrd.com / admin.mwrd.com`.
- [ ] WAF allowlist on `admin.mwrd.com` (office IPs / VPN).
- [ ] Sentry DSN, AWS keys, JWT signing key in production secret manager.
- [ ] Backup cron live; first restore drill scheduled.
- [ ] Staff users seeded via `seed_staff` + TOTP enrolled.
- [ ] Initial customer orgs seeded via `seed_org`; invites sent.
