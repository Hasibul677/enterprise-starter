/**
 * Idempotent seed script. Safe to run multiple times (`yarn seed`):
 * upserts by unique slug/email rather than blind-inserting.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { getEnv } from "@/config/env";
import { RoleModel } from "@/models/role.model";
import { UserModel } from "@/models/user.model";
import { MenuModel } from "@/models/menu.model";
import { hashPassword } from "@/lib/security/password";
import {
  ROLE_SLUGS,
  USER_LAYERS,
  DEFAULT_USER_ROLE_SLUG,
  CORE_RESOURCES,
  MENU_SCOPES,
  NORMAL_USER_DEFAULT_RESOURCE_PERMISSIONS,
} from "@/lib/permissions/constants";
import type { UserLayer } from "@/lib/permissions/constants";

/** Dev-only password shared by the 4 non-super-admin demo accounts - see README "Demo credentials". */
const DEMO_PASSWORD = "Passw0rd!123";

async function main() {
  const env = getEnv();
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB for seeding.");

  const fullPerms = { view: true, add: true, edit: true, delete: true, comment: true };
  const viewOnly = { view: true, add: false, edit: false, delete: false, comment: false };
  const empty = { view: false, add: false, edit: false, delete: false, comment: false };

  // --- Migrate a pre-hierarchy "viewer" role doc to "customer" in place,
  // so a dev DB seeded before this feature doesn't end up with an orphan
  // row once DEFAULT_USER_ROLE_SLUG moves from "viewer" to "customer".
  const legacyViewer = await RoleModel.findOne({ slug: "viewer" });
  const existingCustomerRole = await RoleModel.findOne({ slug: ROLE_SLUGS.CUSTOMER });
  if (legacyViewer && !existingCustomerRole) {
    legacyViewer.slug = ROLE_SLUGS.CUSTOMER;
    legacyViewer.name = "Customer";
    // The roleSeeds upsert loop below fully repopulates every required
    // field (including the newer userLayer) right after this - skip full
    // validation here so a pre-userLayer document doesn't fail on a field
    // this migration step was never responsible for setting.
    await legacyViewer.save({ validateBeforeSave: false });
    console.log("Migrated legacy 'viewer' role to 'customer'.");
  }

  // --- Migrate the pre-userLayer "normal-admin" role slug to "company-admin"
  // in place (same _id, so every existing user/menu reference stays valid) -
  // NORMAL_ADMIN was renamed to COMPANY_ADMIN when the fixed user-layer
  // concept was introduced (see role-hierarchy.ts doc comment).
  const legacyNormalAdmin = await RoleModel.findOne({ slug: "normal-admin" });
  const existingCompanyAdminRole = await RoleModel.findOne({ slug: ROLE_SLUGS.COMPANY_ADMIN });
  if (legacyNormalAdmin && !existingCompanyAdminRole) {
    legacyNormalAdmin.slug = ROLE_SLUGS.COMPANY_ADMIN;
    legacyNormalAdmin.name = "Company Admin";
    await legacyNormalAdmin.save({ validateBeforeSave: false });
    console.log("Migrated legacy 'normal-admin' role to 'company-admin'.");
  }

  // --- The 5 seeded DEFAULT roles, one per fixed user layer (see
  // src/lib/permissions/role-hierarchy.ts). All isSystem: true - none can be
  // deleted/deactivated (requirement #20). SUPER_ADMIN/COMPANY_ADMIN can
  // create unlimited ADDITIONAL roles targeting the applicable layers
  // through the Roles admin UI - these 5 are only the always-present floor.
  // Defaults are deliberately modest for ADMIN/COMPANY_ADMIN/MODERATOR
  // (requirement #12 "do not simply give ADMIN all Super Admin permissions")
  // - a Super Admin/Company Admin explicitly grants more via the Roles page
  // or a per-user permission override.
  const roleSeeds: {
    slug: string;
    name: string;
    description: string;
    userLayer: UserLayer;
    permissions: Record<string, unknown>;
  }[] = [
    {
      slug: ROLE_SLUGS.SUPER_ADMIN,
      name: "Super Admin",
      description: "Full system access. Bypasses standard permission checks.",
      userLayer: USER_LAYERS.SUPER_ADMIN,
      permissions: {
        [CORE_RESOURCES.USERS]: fullPerms,
        [CORE_RESOURCES.ROLES]: fullPerms,
        [CORE_RESOURCES.MENUS]: fullPerms,
        [CORE_RESOURCES.AUDIT_LOG]: viewOnly,
        [CORE_RESOURCES.PERMISSIONS]: fullPerms,
        [CORE_RESOURCES.SETTINGS]: fullPerms,
        [CORE_RESOURCES.COMMENTS]: fullPerms,
        [CORE_RESOURCES.REPORTS]: fullPerms,
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
      },
    },
    {
      slug: ROLE_SLUGS.ADMIN,
      name: "Admin",
      description: "Operates in the Super Admin / Admin area under explicitly assigned permissions.",
      userLayer: USER_LAYERS.ADMIN,
      permissions: {
        [CORE_RESOURCES.USERS]: { ...empty, view: true, edit: true },
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, edit: true },
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
      },
    },
    {
      slug: ROLE_SLUGS.COMPANY_ADMIN,
      name: "Company Admin",
      description: "Manages its own Moderator users and their roles, in a scope separate from Super Admin / Admin.",
      userLayer: USER_LAYERS.COMPANY_ADMIN,
      permissions: {
        [CORE_RESOURCES.USERS]: { ...empty, view: true, add: true, edit: true },
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, edit: true, delete: true },
        [CORE_RESOURCES.REPORTS]: viewOnly,
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
        // Core to being a Company Admin, not something extra to grant -
        // mirrors Super Admin's inherent (bypassed) ability to assign
        // permissions to Admin (requirement #9).
        [CORE_RESOURCES.PERMISSIONS]: { ...empty, view: true, edit: true },
        // Lets a Company Admin create/manage its own unlimited MODERATOR-
        // layer roles (requirement #4) - scoped server-side to roles it
        // owns via Role.managedBy (role.service.ts#createRole/canManageRole).
        [CORE_RESOURCES.ROLES]: { ...empty, view: true, add: true, edit: true, delete: true },
      },
    },
    {
      slug: ROLE_SLUGS.MODERATOR,
      name: "Moderator",
      description: "Operates in the Company Admin / Moderator area under explicitly assigned permissions.",
      userLayer: USER_LAYERS.MODERATOR,
      permissions: {
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, edit: true },
        [CORE_RESOURCES.REPORTS]: viewOnly,
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
      },
    },
    {
      slug: ROLE_SLUGS.CUSTOMER,
      name: "Customer",
      description: "Default role granted to every public registration. Customer-level activities only.",
      userLayer: USER_LAYERS.CUSTOMER,
      permissions: {
        [CORE_RESOURCES.USERS]: NORMAL_USER_DEFAULT_RESOURCE_PERMISSIONS,
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, add: true },
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
      },
    },
  ];

  const roleDocs: Record<string, InstanceType<typeof RoleModel>> = {};
  for (const seed of roleSeeds) {
    roleDocs[seed.slug] = await RoleModel.findOneAndUpdate(
      { slug: seed.slug },
      {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        userLayer: seed.userLayer,
        managedBy: null,
        isSystem: true,
        isActive: true,
        permissions: seed.permissions,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log("Seeded roles:", Object.keys(roleDocs).join(", "));

  // --- Backfill User.userLayer on any pre-existing user (created before
  // this field existed) by deriving it from their current role(s) - the
  // same "every role targets one shared layer" invariant the app now
  // enforces going forward (user.service.ts#resolveRolesLayer).
  const usersMissingLayer = await UserModel.find({ userLayer: { $exists: false } }).populate("roles");
  for (const u of usersMissingLayer) {
    const layers = new Set(
      ((u.roles ?? []) as unknown as { userLayer?: UserLayer }[]).map((r) => r.userLayer).filter(Boolean)
    );
    u.userLayer = (layers.size === 1 ? Array.from(layers)[0] : USER_LAYERS.CUSTOMER) as never;
    await u.save({ validateBeforeSave: false });
  }
  if (usersMissingLayer.length > 0) {
    console.log(`Backfilled userLayer on ${usersMissingLayer.length} pre-existing user(s).`);
  }

  // --- Sanity check: DEFAULT_USER_ROLE_SLUG must exist before registration works.
  if (DEFAULT_USER_ROLE_SLUG !== ROLE_SLUGS.CUSTOMER) {
    throw new Error("DEFAULT_USER_ROLE_SLUG is out of sync with ROLE_SLUGS.CUSTOMER.");
  }

  // --- 5 demo users, one per layer (requirement #1/#11). Super Admin keeps
  // the existing env-driven contract; the other 4 are dev-only fixed
  // accounts sharing DEMO_PASSWORD (documented in README). All idempotent
  // by email.
  async function ensureUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleSlug: string;
    userLayer: UserLayer;
    managedBy?: mongoose.Types.ObjectId | null;
  }) {
    const email = params.email.toLowerCase();
    const existing = await UserModel.findOne({ email }).populate("roles");
    if (existing) {
      const existingSlugs = ((existing.roles ?? []) as unknown as { slug: string }[]).map((r) => r.slug);
      if (!existingSlugs.includes(params.roleSlug)) {
        console.warn(
          `Skipping demo ${params.roleSlug} account: ${email} already exists with role(s) [${existingSlugs.join(", ")}] instead. ` +
            "This usually means SUPER_ADMIN_EMAIL in .env collides with one of the fixed demo emails - " +
            "use a different SUPER_ADMIN_EMAIL (see README) to get a clean set of 5 demo accounts."
        );
      }
      return existing;
    }

    const passwordHash = await hashPassword(params.password);
    const user = await UserModel.create({
      firstName: params.firstName,
      lastName: params.lastName,
      email,
      passwordHash,
      roles: [roleDocs[params.roleSlug]._id],
      userLayer: params.userLayer,
      managedBy: params.managedBy ?? null,
      status: "ACTIVE",
      emailVerified: true,
    });
    console.log(`Created ${params.roleSlug} account:`, email);
    return user;
  }

  const superAdmin = await ensureUser({
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
    firstName: "Super",
    lastName: "Admin",
    roleSlug: ROLE_SLUGS.SUPER_ADMIN,
    userLayer: USER_LAYERS.SUPER_ADMIN,
  });
  void superAdmin;

  await ensureUser({
    // Not "admin@example.com" - that's .env.example's own default
    // SUPER_ADMIN_EMAIL, so using it here would almost always collide.
    email: "demo-admin@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "Admin",
    roleSlug: ROLE_SLUGS.ADMIN,
    userLayer: USER_LAYERS.ADMIN,
  });

  const companyAdmin = await ensureUser({
    email: "companyadmin@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "CompanyAdmin",
    roleSlug: ROLE_SLUGS.COMPANY_ADMIN,
    userLayer: USER_LAYERS.COMPANY_ADMIN,
  });

  // Ownership: this demo moderator is managed by the demo company admin
  // (requirement #10) - COMPANY_ADMIN A/B ownership is what
  // canManageTargetUser() enforces at request time.
  await ensureUser({
    email: "moderator@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "Moderator",
    roleSlug: ROLE_SLUGS.MODERATOR,
    userLayer: USER_LAYERS.MODERATOR,
    managedBy: companyAdmin._id as unknown as mongoose.Types.ObjectId,
  });

  await ensureUser({
    email: "customer@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "Customer",
    roleSlug: ROLE_SLUGS.CUSTOMER,
    userLayer: USER_LAYERS.CUSTOMER,
  });

  // --- SUPER_ADMIN / ADMIN scoped menu (requirement #7). "User Management"
  // is a parent group (no route of its own - see menu-service.ts#build,
  // which only keeps a route-less node in the tree when it has a visible
  // child) containing Users/Roles/Menus as separate pages. The Users page
  // itself still tabs across all 5 layers and still embeds the "Add role"/
  // "Add menu" quick actions (management-view.tsx) - Roles/Menus below are
  // ADDITIONAL full CRUD surfaces, not a replacement.
  await MenuModel.findOneAndUpdate(
    { key: "admin-dashboard" },
    {
      name: "Dashboard",
      key: "admin-dashboard",
      label: "Dashboard",
      // Distinct from the company-admin/customer "dashboard" slugs below:
      // Menu.slug is only unique among siblings under the SAME parentId (see
      // the compound index on menu.model.ts), and all 3 Dashboard entries
      // are top-level (parentId: null), so they'd otherwise collide.
      slug: "admin-dashboard",
      route: "/admin",
      parentId: null,
      level: 1,
      sortOrder: 0,
      isActive: true,
      isVisible: true,
      icon: "layout-dashboard",
      // No resourceKey: buildEffectiveMenuTree()'s canSee() always passes a
      // menu with no resourceKey, same mechanism the CUSTOMER "dashboard"
      // entry below already relies on - Dashboard must always be visible to
      // every layer, never hidden by permission filtering. Scope still
      // restricts it to the admin-area layers; actual route protection comes
      // from (admin)/admin/layout.tsx's requireAdminAreaPage(), not from this
      // menu entry.
      resourceKey: null,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const adminUserManagementParent = await MenuModel.findOneAndUpdate(
    { key: "user-management-parent-admin" },
    {
      name: "User Management",
      key: "user-management-parent-admin",
      label: "User Management",
      slug: "user-management",
      route: null,
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      resourceKey: null,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Repurposing the existing "user-management" key (rather than creating a
  // new one) means `yarn seed` updates it in place for anyone who already
  // has it in their database - only its label/slug/parentId/level/sortOrder
  // change; its key, route, resourceKey and scope stay exactly as before.
  await MenuModel.findOneAndUpdate(
    { key: "user-management" },
    {
      name: "Users",
      key: "user-management",
      label: "Users",
      slug: "users",
      route: "/admin/management",
      parentId: adminUserManagementParent._id,
      level: 2,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      // Gated on USERS (not a 3-way OR of users/roles/menus, which Menu's
      // single resourceKey field can't express) - the Roles/Menus sections
      // inside the page are independently permission-gated regardless, same
      // as every row-level action elsewhere in this app.
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "roles-management-admin" },
    {
      name: "Roles",
      key: "roles-management-admin",
      label: "Roles",
      slug: "roles",
      route: "/admin/roles",
      parentId: adminUserManagementParent._id,
      level: 2,
      sortOrder: 2,
      isActive: true,
      isVisible: true,
      icon: "shield",
      resourceKey: CORE_RESOURCES.ROLES,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "menus-management-admin" },
    {
      name: "Menus",
      key: "menus-management-admin",
      label: "Menus",
      slug: "menus",
      route: "/admin/menus",
      parentId: adminUserManagementParent._id,
      level: 2,
      sortOrder: 3,
      isActive: true,
      isVisible: true,
      icon: "list",
      resourceKey: CORE_RESOURCES.MENUS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Retire the now-obsolete child/sibling menu entries this consolidation
  // replaces - findOneAndUpdate's upsert-by-key never deletes a stale key on
  // its own, so a one-time cleanup is needed to avoid dead sidebar links.
  await MenuModel.deleteMany({
    key: {
      $in: [
        "users",
        "user-list",
        "roles",
        "menus",
        "permission-management",
        "moderators",
        "moderator-list",
        "moderator-roles",
      ],
    },
  });

  await MenuModel.findOneAndUpdate(
    { key: "system-settings" },
    {
      name: "System Settings",
      key: "system-settings",
      label: "System Settings",
      slug: "system-settings",
      route: "/admin/settings",
      parentId: null,
      level: 1,
      sortOrder: 4,
      isActive: true,
      isVisible: true,
      icon: "settings",
      resourceKey: CORE_RESOURCES.SETTINGS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // --- COMPANY_ADMIN / MODERATOR scoped menu (requirement #7) - a separate
  // tree from the one above, per requirement #4. Same "User Management"
  // parent-group shape as the admin side, but no Menus entry - menu
  // management stays admin-only (see menus/[id]/route.ts, requireAdminAreaAccess).
  await MenuModel.findOneAndUpdate(
    { key: "company-admin-dashboard" },
    {
      name: "Dashboard",
      key: "company-admin-dashboard",
      label: "Dashboard",
      // See "admin-dashboard" above for why this can't just be "dashboard".
      slug: "company-admin-dashboard",
      route: "/company-admin",
      parentId: null,
      level: 1,
      sortOrder: 0,
      isActive: true,
      isVisible: true,
      icon: "layout-dashboard",
      // No resourceKey - always visible, see the admin-side "admin-dashboard"
      // entry above for the full rationale.
      resourceKey: null,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const companyAdminUserManagementParent = await MenuModel.findOneAndUpdate(
    { key: "user-management-parent-company-admin" },
    {
      name: "User Management",
      key: "user-management-parent-company-admin",
      label: "User Management",
      // Distinct from the admin-side parent's "user-management" slug: both
      // are top-level (parentId: null), and slug is only unique among
      // siblings under the same parent (menu.model.ts compound index).
      slug: "company-user-management",
      route: null,
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      resourceKey: null,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "moderator-management" },
    {
      name: "Users",
      key: "moderator-management",
      label: "Users",
      // Distinct from the admin-side "users" slug: both are now siblings
      // under their own "User Management" parent, and Menu.slug is only
      // unique among siblings (see the unique compound index on
      // menu.model.ts) - but each parent has its own sibling set, so reusing
      // "users" here is fine.
      slug: "users",
      route: "/company-admin/management",
      parentId: companyAdminUserManagementParent._id,
      level: 2,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "roles-management-company-admin" },
    {
      name: "Roles",
      key: "roles-management-company-admin",
      label: "Roles",
      slug: "roles",
      route: "/company-admin/roles",
      parentId: companyAdminUserManagementParent._id,
      level: 2,
      sortOrder: 2,
      isActive: true,
      isVisible: true,
      icon: "shield",
      resourceKey: CORE_RESOURCES.ROLES,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "comments" },
    {
      name: "Comments",
      key: "comments",
      label: "Comments",
      slug: "comments",
      route: "/company-admin/comments",
      parentId: null,
      level: 1,
      sortOrder: 2,
      isActive: true,
      isVisible: true,
      icon: "message-square",
      resourceKey: CORE_RESOURCES.COMMENTS,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "reports" },
    {
      name: "Reports",
      key: "reports",
      label: "Reports",
      slug: "reports",
      route: "/company-admin/reports",
      parentId: null,
      level: 1,
      sortOrder: 3,
      isActive: true,
      isVisible: true,
      icon: "bar-chart",
      resourceKey: CORE_RESOURCES.REPORTS,
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // CUSTOMER's own menu item, outside the scope system entirely: no
  // resourceKey/scope, so buildEffectiveMenuTree() shows it to any
  // authenticated user regardless of role/permissions.
  await MenuModel.findOneAndUpdate(
    { key: "dashboard" },
    {
      name: "Dashboard",
      key: "dashboard",
      label: "Dashboard",
      slug: "dashboard",
      route: "/dashboard",
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seeded starter 3-level menus for both scopes.");

  await mongoose.disconnect();
  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
