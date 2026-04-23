# MWRD Connect

B2B procurement platform connecting verified clients with suppliers. Clients submit RFQs, suppliers respond with quotes, and admins review and approve every transaction.

## Tech stack

- **Frontend:** Vite + React 18 + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + Radix primitives
- **Backend:** [Convex](https://convex.dev) (database, functions, auth, HTTP endpoints)
- **Auth:** `@convex-dev/auth` with the Password provider
- **Email:** [Resend](https://resend.com) HTTP API (called from a Convex action)
- **Testing:** Vitest + Testing Library + jsdom

## Project layout

```
convex/                Convex backend (schema, queries, mutations, actions, HTTP routes)
  _generated/          Auto-generated types — do not edit
  auth.ts              Password provider + profile creation callback
  email.ts             Resend email sender
  schema.ts            Database schema
  http.ts              Public HTTP endpoints (e.g. /submit-lead)
  leads.ts             Interest submissions + admin approval flow
  users.ts             Profile queries + password change action
  ...                  (products, rfqs, quotes, payments, payouts, etc.)
public/landing/        Static marketing page (served at /landing)
src/
  pages/               Route-level screens grouped by role (admin/, client/, supplier/)
  components/          Shared UI (shadcn primitives + feature components)
  hooks/useAuth.tsx    Auth context wrapping @convex-dev/auth
  contexts/            Language + theming providers
```

## Getting started

```sh
# 1. Install dependencies
npm install

# 2. Start the Convex backend (first run will prompt you to log in and link a deployment)
npx convex dev

# 3. In another terminal, start the Vite dev server
npm run dev
```

The frontend reads `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` from `.env.local`, which `npx convex dev` creates automatically.

## Required Convex environment variables

Set these on your Convex deployment with `npx convex env set <NAME> <VALUE>`:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | API key used by `convex/email.ts` to send transactional email. |
| `RESEND_FROM` | From address, e.g. `"MWRD <no-reply@yourdomain.com>"`. Defaults to Resend's sandbox sender, which only delivers to your Resend account email. |
| `APP_URL` | Public login URL included in credentials emails, e.g. `https://app.mwrd.example/login`. |

## Onboarding flow

1. **Interest:** Visitor submits the form on `/landing`. It POSTs to the Convex HTTP route `/submit-lead`, which inserts a row into `interest_submissions` with status `PENDING`.
2. **Review:** An admin opens **Admin → Leads** (`/admin/leads`), reviews the submission, and clicks **Approve & email credentials**.
3. **Provisioning:** `leads.approveAndCreateAccount` generates a 16-character temporary password, signs up a new user with the admin-chosen role (`CLIENT` or `SUPPLIER`), marks the profile `ACTIVE`, and sets `must_change_password = true`.
4. **Email:** Resend delivers the temporary credentials to the user.
5. **First login:** The user signs in; `ProtectedRoute` detects `must_change_password` and redirects them to `/change-password`. Their new password is written via `modifyAccountCredentials`, the flag is cleared, and they're routed to their role dashboard.

## Available scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite in development mode on port 8080 (auto-reassigned if busy) |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build (sourcemaps, non-minified) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the repo |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npx convex dev` | Sync schema and functions to the dev Convex deployment |
| `npx convex deploy` | Deploy Convex functions to production |

## Deployment

Any static host works for the frontend (Vercel, Netlify, Cloudflare Pages, etc.). The Convex backend is hosted by Convex — run `npx convex deploy` for production. Make sure production Convex env vars (`RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`) are set before the approval flow is used.
