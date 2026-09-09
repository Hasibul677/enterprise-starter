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

yarn seed   # idempotent: creates the 5 RBAC roles, one demo user per role,
            # and a starter 3-level menu for each dashboard scope. Safe to re-run.

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
| `yarn seed` | Idempotent DB seed (5 RBAC roles, 5 demo users, starter menus) |
| `yarn format` | Prettier - write |
| `yarn format:check` | Prettier - check only (CI-friendly) |

## First login

After `yarn seed`, sign in at `/login` with the `SUPER_ADMIN_EMAIL` /
`SUPER_ADMIN_PASSWORD` from your `.env.local`. From there: **Roles** to define
permission sets, **Menus** to extend the sidebar, **Users** to manage
accounts.

## Role-Based Access Control

The app ships with exactly 5 fixed, structural **user layers** - never more,
never fewer - enforced server-side at every layer (route, page, and API),
never only in the sidebar. **Roles are a separate, unlimited concept**: a
`Role` is just a named permission bundle that targets one layer, and
SUPER_ADMIN/COMPANY_ADMIN can create as many as they want without ever
creating a new hierarchy level. See [`CLAUDE.md`](./CLAUDE.md) for the full
architecture; this is the practical summary.

```text
SUPER_ADMIN
    |-- ADMIN
    `-- COMPANY_ADMIN
          `-- MODERATOR
CUSTOMER (independent - public/registered users)
```

| User layer | Dashboard | Can do |
|---|---|---|
| **SUPER_ADMIN** | `/admin/**` | Full system access. Creates ADMIN/COMPANY_ADMIN accounts, edits role definitions (and can create unlimited new roles targeting ADMIN/COMPANY_ADMIN/CUSTOMER), creates menus, assigns permissions to ADMIN users. Bypasses all permission checks. |
| **ADMIN** | `/admin/**` (shared with Super Admin) | Only what Super Admin explicitly grants (role permissions + per-user overrides). Can create CUSTOMER accounts. Cannot create another ADMIN, cannot touch Super Admin. |
| **COMPANY_ADMIN** | `/company-admin/**` (separate scope) | Creates and manages its OWN Moderator users (ownership via `managedBy`) and can create unlimited custom roles for them (e.g. "Recruiter", "Content Moderator" - each still just a MODERATOR-layer user), assigns permissions within the Company Admin/Moderator resource set. Cannot reach `/admin/**` at all. |
| **MODERATOR** | `/company-admin/**` (shared with its Company Admin) | Only what its Company Admin explicitly grants, via whichever role it was assigned. Cannot create users or touch roles/permissions. |
| **CUSTOMER** | `/dashboard/**` | Default layer for public registration. Customer-level activities only - no administrative area. |

**Where the hierarchy actually lives:** `src/lib/permissions/role-hierarchy.ts`
is the single source of truth for who can create/manage which **layer**
(`CREATABLE_LAYERS_BY`, `MANAGEABLE_TARGET_LAYERS_BY`), which layer a granter
may grant permissions to (`PERMISSION_GRANTERS`, `GRANTABLE_RESOURCES_BY`),
and which layer SUPER_ADMIN/COMPANY_ADMIN may create a new *role* for
(`CREATABLE_ROLE_LAYERS_BY`). Every function takes a `UserLayer` scalar,
never a role name/slug - a role only ever determines capabilities, never
rank. Every route handler re-derives authority from there - nothing is
inferred from client state (`src/stores/auth-store.ts` is a UI convenience
cache only).

**Per-user permission overrides:** beyond a role's shared baseline
(`Role.permissions`), Super Admin can grant an individual ADMIN extra access,
and a Company Admin can grant an individual MODERATOR it manages extra
access, via `PATCH /api/users/[id]/permissions` - without affecting any
other ADMIN/MODERATOR holding the same role. A grant can never exceed what
the granter itself holds, and no one can grant themselves anything.

**Menu scope:** every menu created through the Menu admin UI must declare a
scope - `Super Admin / Admin` or `Company Admin / Moderator` - stored on the
`Menu` document and enforced in `buildEffectiveMenuTree()`. A Company Admin
or Moderator never receives a Super Admin/Admin menu item, and vice versa;
Super Admin sees both.

**Live permission sync:** while a user is logged in, an admin's change to
their role, permissions, or menu access takes effect automatically within
~20s (or immediately on tab focus) - no logout/refresh needed. If the page
they're on becomes inaccessible, they're redirected to their dashboard with
an "Access Updated" notice; if only an action permission changed, the
relevant button just disappears. See `src/lib/auth/use-permission-sync.ts`.

### Demo credentials

Created by `yarn seed`, one account per layer. The Super Admin account uses
your `.env.local`'s `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`; the other 4
share a fixed dev-only password.

| Layer | Email | Password |
|---|---|---|
| SUPER_ADMIN | `SUPER_ADMIN_EMAIL` from `.env.local` | `SUPER_ADMIN_PASSWORD` from `.env.local` |
| ADMIN | `demo-admin@example.com` | `Passw0rd!123` |
| COMPANY_ADMIN | `companyadmin@example.com` | `Passw0rd!123` |
| MODERATOR | `moderator@example.com` (managed by the Company Admin above) | `Passw0rd!123` |
| CUSTOMER | `customer@example.com` | `Passw0rd!123` |

> `.env.example` defaults `SUPER_ADMIN_EMAIL` to `admin@example.com`, which is
> why the ADMIN demo account above is `demo-admin@example.com` instead - it
> would otherwise collide with your own Super Admin account. If you've since
> changed `SUPER_ADMIN_EMAIL` to something that collides with one of the 4
> fixed demo emails above, `yarn seed` logs a warning and skips that demo
> account rather than silently overwriting your Super Admin.

### "Login as User" impersonation

Super Admin can impersonate any Admin/Company Admin/Moderator/Customer
account from the **Users** list (never another Super Admin, never itself,
never a non-active account) via a "Login as user" row action, which
confirms, then navigates to the target's dashboard in the same tab (a full
reload, so no client-side state leaks between sessions).

This is a real server-issued session for the target user (`POST
/api/auth/impersonate` mints it through the exact same `issueTokenPair()`
every normal login uses), not client-side state - every permission/menu/
route check that already exists runs completely unchanged and correctly
treats it as that user, including rejecting the target's own inaccessible
routes. A persistent banner shows on every page while impersonating, with a
**Return to Super Admin** button (`POST /api/auth/impersonate/end`) that
restores the original session with no password re-entry - the target's
identity is read from the session's own signed `impersonatedBy` claim, not
from anything client-supplied, and is re-verified fresh against the DB.
Both the start and end are audit-logged (`IMPERSONATION_STARTED` /
`IMPERSONATION_ENDED`).

**Known browser limitation:** the new tab shares the same cookie jar as
every other tab on this origin (there is no such thing as a per-tab cookie
in a browser) - so while impersonating, ANY tab of this app in the same
browser reflects the impersonated session too, not just the one you opened.
This is standard behavior for any cookie-authenticated site (logging out in
one tab logs every tab out); the persistent banner exists specifically so
it's never ambiguous which session is currently active, and "Return to
Super Admin" works from any tab.

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
