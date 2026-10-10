# InsightHire Admin

Operator console for InsightHire at `admin.insighthire.com`. A separate Next.js 14 app so staff tooling never ships inside the customer app.

## What is here

Navigation groups (`lib/admin-nav.ts`):

| Group | Pages |
| --- | --- |
| Home | Platform overview |
| Attention | Alerts, Attention queue (stuck candidates), Anomalies |
| Tenants | Organizations (detail, users, journeys, candidates, culture, impersonation, demo tenant), Tenant health, Activation, Admins, Roles |
| Content | Blog, Email templates, Marketing tags, Compliance copy |
| Operations | Pipeline, Scoring runs, Scheduled jobs, Sourcing runs, Outreach runs, AI costs, Releases, Incidents, Client errors, Traffic, Reliability (E2E results), Communications (email monitoring) |
| Billing | Billing & alerts, Revenue |
| Sales | Sales dashboard |
| System | Announcements, Feature flags, Impersonation audit, Integrations & tenant feature grants, Languages, Audit log, GDPR, DevOps skills |

Retired pages redirect: `/leads` → `/` (leads live in InsightCRM), `/jobs` and `/pipeline` → `/background-jobs`, `/reliability` → `/e2e-results`, `/stuck-candidates` → `/attention`, `/indeed-integration` → `/integrations`.

## Authentication

**Authio only.** Staff sign in at `/sign-in` with their Microsoft 365 account through Authio SSO; `/login` redirects there. `middleware.ts` (`createAuthioMiddleware`) protects every route. Authio tokens live in HttpOnly cookies (`authio_session`, `authio_refresh`); no auth token is stored in `localStorage` (the legacy `/api-monitoring` page still reads a stale `auth_token` key and is tracked as HIRE-ADM-18).

Browser tRPC calls go to the same-origin BFF proxy `app/api/trpc/[...trpc]/route.ts`, which reads the session cookie server-side and forwards to `insighthire-api` with `Authorization: Bearer …`. Authorization (platform role tiers, read-only support roles, super-admin-only actions such as impersonation) is enforced by the API, not by this app.

Impersonation opens a one-time-code link (`/api/auth/impersonate?code=…` on the customer app); the session token never appears in a URL or in this app's storage.

## Environment variables

```bash
# Public URLs (build-time)
NEXT_PUBLIC_APP_URL=https://admin.insighthire.com
NEXT_PUBLIC_API_URL=https://api.insighthire.com
NEXT_PUBLIC_TRPC_URL=https://api.insighthire.com/trpc
NEXT_PUBLIC_DEVOPS_APP_NAME=            # label shown in the DevOps console (optional)

# Authio operator SSO
AUTHIO_PROJECT_ID=
AUTHIO_ORGANIZATION_ID=
AUTHIO_SSO_CONNECTION_ID=
AUTHIO_SSO_HOST=https://sso.authio.com
AUTHIO_SECRET_KEY=
AUTHIO_API_URL=https://api.authio.com
AUTHIO_AUTH_CORE_URL=https://identity.authio.com
AUTHIO_HOSTED_UI_URL=https://auth.insighthire.com
AUTHIO_JWKS_URL=
AUTHIO_JWT_ISSUER=
AUTHIO_JWT_AUDIENCE=authio

# DevOps console (server-side)
DEVOPS_WORKER_URL=
DEVOPS_INTERNAL_TOKEN=

# Set by Railway
RAILWAY_GIT_COMMIT_SHA=
NODE_ENV=production
PORT=3000
```

## Development

```bash
npm install
npm run dev          # http://localhost:3011
npm test             # vitest
npm run type-check   # tsc --noEmit (Alpine count is the baseline, see .tsc-baseline)
```

## Deployment

Railway service `insighthire-admin` (project `insighthire`, production), built from `main`. See `RAILWAY_DEPLOYMENT.md`.
