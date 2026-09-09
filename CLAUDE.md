# CLAUDE.md

This file is the standing contract for any future work (by Claude or a human)
on this codebase. It is a **foundation**, not a demo - read this before adding
a module.

## Package manager

**Yarn only.** Never use `npm` or `pnpm`, never `--force` / `--legacy-peer-deps`.

```
corepack enable
yarn install
```

`package.json` pins `"packageManager": "yarn@4.5.0"` so Corepack fetches the
correct Yarn Berry release automatically on a normal machine.

> **Sandbox note:** this project was originally scaffolded inside a network-restricted
> sandbox where Corepack's fetch endpoint (`repo.yarnpkg.com`) was blocked, so
> the initial `yarn.lock` was generated with Yarn Classic 1.22.22 instead. On
> your machine, delete `yarn.lock`, run `corepack enable && yarn set version stable`,
> then `yarn install` again to regenerate it under Berry. Everything else
> (scripts, dependencies) is unaffected.

## Architecture (do not bypass)

```
Client/UI
  -> Centralized API Client (src/lib/api-client)
  -> API Route Handler (src/app/api/**)
  -> Zod validation (src/features/**/schemas)
  -> Auth guard: resolveCurrentAccess() (src/lib/auth/current-user.ts)
  -> Authorization guard: requirePermission() (src/lib/permissions/guard.ts)
  -> Service (src/services)
  -> Repository (src/repositories)
  -> Mongoose model (src/models) -> MongoDB
  -> Common ApiResponse<T> envelope (src/lib/api/response.ts)
```

- **Never** put business logic directly in a route handler - call a service.
- **Never** query MongoDB directly from a UI component - go through a repository.
- **Never** trust frontend permission checks as security. Every mutating route
  independently calls `requirePermission()`. `<PermissionGuard>` / `<Can>` /
  `usePermission()` are UX only.

## Security rules (non-negotiable)

- Backend authorization is always the final authority. `resolveCurrentAccess()`
  re-reads user status + `tokenVersion` from the DB on every request - never
  cache authorization decisions across requests.
- Do not store tokens in `localStorage`. Both access and refresh tokens are
  HttpOnly cookies (`src/lib/security/cookies.ts`); CSRF uses a double-submit
  cookie (`x-csrf-token` header, verified in `src/lib/security/csrf.ts`).
- JWT payloads stay minimal (`sub`, `sessionId`, `tokenType`, `tokenVersion`,
  `jti`, standard claims, plus the optional `impersonatedBy` claim below).
  Never add user objects, permissions, or menus to a token.
- Refresh tokens rotate on every use (`src/lib/auth/session-service.ts`).
  Reuse of an already-rotated refresh token revokes the session - this is a
  security event, not a retryable error.
- Public registration (`POST /api/auth/register`) can only ever create a
  Customer-role user. Zod schemas are allow-lists: extra client fields
  (`roles`, `isSuperAdmin`, `status`, ...) are silently dropped, never trusted.
- Super Admin authority comes from the DB (`role.slug === "super-admin"` +
  `role.isActive`), resolved server-side in `resolveCurrentAccess()`. Never
  trust a client-supplied `isSuperAdmin` flag.
- System roles (`isSystem: true`) cannot be deleted/deactivated; neither can
  a role that's still assigned to any user (`role.service.ts`
  `assertRoleHasNoAssignedUsers()`) - reassign every holder first. The last
  active Super Admin cannot be removed (see `deactivateRole()`).
- The 3-level menu hierarchy is validated on every create/update
  (`validateMenuHierarchy()`): no self-parenting, no cycles, max depth 3.
- Super Admin "Login as User" impersonation (`POST /api/auth/impersonate` /
  `.../impersonate/end`, `src/lib/auth/auth-service.ts`) issues a REAL
  session for the target via the same `issueTokenPair()` every login uses -
  never a client-side role swap. The `impersonatedBy` JWT/session claim is
  metadata only (drives the banner + "Return to Super Admin"); every
  authorization decision still keys off `sub`/`userId` alone, so an
  impersonated session can never itself carry Super Admin authority.
  Eligibility (`getImpersonationIneligibleReason()` in
  `role-hierarchy.ts`) blocks impersonating another Super Admin, yourself,
  or a non-active account.

## API conventions

- Every response is `ApiResponse<T>` (`src/lib/api/response.ts`): `success`,
  `statusCode`, `code`, `message`, `data`, optional `meta.pagination`, optional
  `errors[]`.
- Route handlers wrap their body in `try { ... } catch (err) { return
  handleRouteError(err); }` - never leak stack traces, Mongo internals, or
  secrets in a response.
- Field-level validation errors use `{ field, code, message }` so the
  frontend can call `form.setError(field, ...)` (`applyServerErrors()`).

## RBAC rules

- Permissions are a `PermissionMap`: `Record<resourceKey, { view, add, edit,
  delete }>`. Add new resource keys as plain strings (`src/lib/permissions/constants.ts`)
  - never touch the merge algorithm to add a module.
- Multi-role merge is UNION/OR across **active** roles only
  (`mergeRolePermissions()`). Do not introduce deny-permissions without
  revisiting this algorithm and its tests.
- **User layer vs Role are separate concepts.** `USER_LAYERS` (in
  `src/lib/permissions/constants.ts`) is the fixed, structural 5-layer
  hierarchy - `SUPER_ADMIN -> {ADMIN, COMPANY_ADMIN -> MODERATOR}`, plus an
  independent `CUSTOMER` - stored on `User.userLayer` and NEVER derived from
  which role(s) a user holds. `Role` documents are dynamic, unlimited
  permission bundles that each target exactly one layer (`Role.userLayer`,
  immutable after creation); creating a role never creates a new layer, and
  a role's name/slug/id carries no hierarchy authority. Every authority
  check in `src/lib/permissions/role-hierarchy.ts` takes a `UserLayer`
  scalar, never a role slug/array - who can create/manage which layer
  (`CREATABLE_LAYERS_BY`, `MANAGEABLE_TARGET_LAYERS_BY`), which layer a
  granter may grant permissions to (`PERMISSION_GRANTERS`,
  `GRANTABLE_RESOURCES_BY`), which layer SUPER_ADMIN/COMPANY_ADMIN may
  create a *role* for (`CREATABLE_ROLE_LAYERS_BY`), and who may edit/deactivate
  a given role (`canManageRole()`, using `Role.managedBy` ownership).
  `ROLE_SLUGS` still exists but only identifies the 5 seeded *default* roles
  (e.g. for public registration) - extend these tables for new authority
  rules; never hardcode a role-slug/name check anywhere for a hierarchy
  decision.
- SUPER_ADMIN can create additional roles targeting `ADMIN`/`COMPANY_ADMIN`/
  `CUSTOMER`; a `COMPANY_ADMIN` can create unlimited additional roles, but
  only ever targeting `MODERATOR`, and only for itself (`Role.managedBy` set
  to its own user id) - a peer `COMPANY_ADMIN` never sees or can assign them
  (`role.service.ts#listRolesForActor`/`createRole`). Deactivating a
  *custom* (non-`isSystem`) role is allowed even while users hold it - the
  live permission-sync (`permissionVersion`, see below) degrades them
  gracefully; the 5 `isSystem` default roles remain undeletable/undeactivatable
  regardless of assignment.
- `/admin/**` is the shared SUPER_ADMIN/ADMIN dashboard tree
  (`requireAdminAreaAccess()`/`requireAdminAreaPage()`); `/company-admin/**`
  is the shared COMPANY_ADMIN/MODERATOR tree
  (`requireCompanyAdminAreaAccess()`/`requireCompanyAdminAreaPage()`),
  completely separate menus/routes from `/admin/**`. Both are additionally
  gated by ordinary `requirePermission()` for the specific action - the area
  guard only proves the actor belongs in that dashboard at all.
- `User.managedBy` records COMPANY_ADMIN -> MODERATOR ownership (who created/
  manages that moderator); `User.permissionOverrides` is a per-user
  `PermissionMap` unioned on top of the role-derived baseline the same way
  multiple roles union - see `current-user.ts`. Both are enforced via
  `canManageTargetUser()`/`canGrantPermissionOverride()`, never inferred.
- `Menu.scope` (`MENU_SCOPES.SUPER_ADMIN_ADMIN` / `COMPANY_ADMIN_MODERATOR`)
  is required on every menu created through the Menu admin UI and filters
  `buildEffectiveMenuTree()` in addition to the existing resourceKey
  permission check.
- `User.permissionVersion` is bumped whenever authorization state affecting
  that user changes (own status/roles/overrides, or a role/menu it depends
  on) - see `use-permission-sync.ts` (client poll) and the
  `incrementPermissionVersion*` calls in `role.service.ts`/`menu.service.ts`/
  `user.service.ts`. Never repurpose `tokenVersion` for this - that one
  forces a full logout, this one only refreshes cached permissions/menus.

## Component rules

- Before creating a new UI component, check `src/components/ui`,
  `src/components/forms`, `src/components/feedback`, `src/components/data-table`,
  `src/components/modal`, `src/components/navigation` first. Extend, don't
  duplicate.
- Every form uses React Hook Form + Zod + `@hookform/resolvers` via the
  shared `<Form>` / `<FormField>` wrappers (`src/components/forms`). Do not
  hand-roll `useState` per field for anything beyond a single ad-hoc input.
- New CRUD modules follow the Users/Roles/Menus pattern: list page uses
  `<DataTable>`, create/edit pages use `<Form>` + `<FormField>`, destructive
  actions use `<DeleteButton>` / `<ConfirmButton>`.

## Folder conventions

- `src/features/<module>/schemas/*.schema.ts` - Zod, one file per operation
  (`*-create.schema.ts`, `*-update.schema.ts`).
- `src/models` - Mongoose schemas only.
- `src/repositories` - raw DB queries, no business rules.
- `src/services` - business rules, calls repositories + audit log.
- `src/app/api/**/route.ts` - thin: connect DB, resolve access, validate,
  call a service, return `ok()/created()/handleRouteError()`.

## Adding a new business module (Products, Orders, Inventory, ...)

You should only ever need to add:

1. `src/models/<module>.model.ts`
2. `src/repositories/<module>.repository.ts`
3. `src/services/<module>.service.ts`
4. `src/features/<module>/schemas/*.schema.ts`
5. `src/app/api/<module>/route.ts` + `[id]/route.ts`
6. A new `CORE_RESOURCES`-style key (or just a plain string resourceKey)
7. A Menu row (via the Menus admin UI or the seed script) pointing at your
   new route + resourceKey
8. List/create/edit pages reusing `<DataTable>` / `<Form>` / `<FormField>`

You should **never** need to touch: JWT signing/verification, refresh
rotation, session management, the permission merge algorithm, the menu
hierarchy engine, the API client, the `ApiResponse` envelope, or the base
form/table/dialog components.

## Testing rules

- `yarn test` (Vitest) covers pure logic: password hashing, JWT sign/verify
  and expiry, permission merge, effective-menu-tree building. Add a unit test
  in `tests/unit` for any new pure-logic module.
- `yarn test:e2e` (Playwright) covers auth flows end-to-end. It requires a
  running MongoDB and browser binaries (`npx playwright install`) - not
  runnable inside the original scaffolding sandbox; run it on your machine.
- Do not claim a test/build passed without actually running the command.

## What NOT to do (see also `src/**` doc comments)

- Do not bypass backend authorization.
- Do not store tokens in `localStorage`.
- Do not duplicate the `ApiResponse` schema.
- Do not duplicate reusable UI components for a minor styling difference.
- Do not use `npm`.
- Do not weaken TypeScript strict mode or scatter `any`.
- Do not disable a lint rule to silence a real problem - fix the problem.
- Do not skip Zod validation on any route accepting a request body.
- Do not put business logic in a random component or route handler.

## Rate limiting

`src/lib/security/rate-limit.ts` defines a storage-agnostic `RateLimiter`
interface, wired into login/register/refresh. The shipped implementation is
in-memory and explicitly documented as **not** safe for multi-instance or
serverless production deployments (counters are process-local). Implement
the same interface against Redis (`ioredis` / `@upstash/redis`) before
scaling beyond one instance - no call site needs to change.

## Formatting

`yarn format` (Prettier, write) / `yarn format:check` (CI-friendly check).
ESLint owns correctness, Prettier owns formatting - `eslint-config-prettier`
disables any ESLint stylistic rule that would conflict.

## Menu `key` vs `slug`

Menu items have both a `key` (a stable, globally-unique, never-changed-after-
creation programmatic identifier) and a `slug` (unique only among siblings,
free to change on reparent). Reference menus programmatically by `key`, not
`slug` or `_id`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
