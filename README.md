# Enterprise Starter

A reusable, secure Next.js foundation for enterprise applications (ERP, CRM,
HRM, Inventory, POS, e-commerce, SaaS, admin platforms, ...). See
[`CLAUDE.md`](./CLAUDE.md) for the full architecture, security rules, and
conventions this project follows.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · MongoDB /
Mongoose · Zod · Zustand · React Hook Form · Day.js · jose (JWT) · Motion.

## Setup

```bash
corepack enable
yarn set version stable
yarn install

cp .env.example .env.local
# edit .env.local: set MONGODB_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
# SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD.
# Generate secrets with: openssl rand -base64 48

yarn seed   # idempotent: creates Super Admin + Viewer roles, super admin
            # account, and a starter 3-level menu. Safe to re-run.

yarn dev    # http://localhost:3000
```

> **If you're on the machine this was scaffolded on (a sandboxed container):**
> Corepack's `repo.yarnpkg.com` fetch was blocked there, so the lockfile was
> generated with Yarn Classic 1.22.22 as a fallback. On a normal machine,
> delete `yarn.lock` and re-run the three `corepack`/`yarn` commands above to
> regenerate it under Yarn Berry 4.5.0 as `package.json` specifies.

## Scripts

| Script | Purpose |
|---|---|
| `yarn dev` | Start the dev server |
| `yarn build` | Production build |
| `yarn start` | Run the production build |
| `yarn lint` | ESLint |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn test` | Vitest unit tests |
| `yarn test:e2e` | Playwright end-to-end tests (needs `npx playwright install` once) |
| `yarn seed` | Idempotent DB seed (roles, super admin, starter menu) |
| `yarn format` | Prettier - write |
| `yarn format:check` | Prettier - check only (CI-friendly) |

## First login

After `yarn seed`, sign in at `/login` with the `SUPER_ADMIN_EMAIL` /
`SUPER_ADMIN_PASSWORD` from your `.env.local`. From there: **Roles** to define
permission sets, **Menus** to extend the sidebar, **Users** to manage
accounts.

## Extending with a new module

See "Adding a new business module" in [`CLAUDE.md`](./CLAUDE.md) - in short:
a model, repository, service, Zod schemas, API routes, a permission resource
key, a menu entry, and pages built from the existing `<DataTable>` /
`<Form>` / `<FormField>` components. The auth, RBAC, menu, and API-client
infrastructure never needs to change.

## Before deploying to production

- **Rate limiting** (`src/lib/security/rate-limit.ts`) ships as an in-memory
  limiter for local development only - it is explicitly not safe across
  multiple instances/serverless invocations. Swap in a Redis-backed
  implementation of the same `RateLimiter` interface first.
- Consider swapping `bcryptjs` for a native `argon2` binding if your
  deployment target supports native modules.
- Regenerate `yarn.lock` under real Yarn Berry (see the note above) rather
  than shipping the Yarn-Classic-generated one from the scaffolding sandbox.
# enterprise-starter
