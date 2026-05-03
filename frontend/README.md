# MWRD Frontend Monorepo

Three deployable apps + shared packages.

## Layout

```
apps/
  admin/      -> admin.mwrd.com    (MWRD staff only)
  client/     -> app.mwrd.com      (client orgs)
  supplier/   -> suppliers.mwrd.com (supplier orgs)
packages/
  ui/         shared components, design tokens
  api/        generated TypeScript client (from backend OpenAPI)
  auth/       session, guards, hooks
  i18n/       ar/en translations
  utils/      formatters, validators, types
```

## First-time setup

```bash
pnpm install
pnpm exec turbo --version   # sanity check

# Scaffold the three apps (one-time):
cd apps && pnpm create vite admin --template react-ts
cd ../apps && pnpm create vite client --template react-ts
cd ../apps && pnpm create vite supplier --template react-ts

# Scaffold shared packages (one-time):
mkdir -p packages/{ui,api,auth,i18n,utils}/src
# Add a minimal package.json to each (see packages/api below as template).
```

## Generating the API client

The Django backend exposes OpenAPI at `/api/schema/`. Run:

```bash
pnpm api:generate
```

This writes typed schema into `packages/api/src/schema.ts`. Apps import from
`@mwrd/api` — never hand-write API response types.

## Dev

```bash
pnpm dev   # runs all three apps in parallel via Turborepo
```

Each app should be configured to a different port:
- admin: 5175
- client: 5173
- supplier: 5174
