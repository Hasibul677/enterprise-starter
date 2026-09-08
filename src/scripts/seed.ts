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
  DEFAULT_USER_ROLE_SLUG,
  CORE_RESOURCES,
  MENU_SCOPES,
  NORMAL_USER_DEFAULT_RESOURCE_PERMISSIONS,
} from "@/lib/permissions/constants";

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
    await legacyViewer.save();
    console.log("Migrated legacy 'viewer' role to 'customer'.");
  }

  // --- The 5 fixed roles the RBAC hierarchy is built around (see
  // src/lib/permissions/role-hierarchy.ts). All isSystem: true - "exactly 5
  // roles must exist" (requirement #20), so none can be deleted/deactivated.
  // Defaults are deliberately modest for ADMIN/NORMAL_ADMIN/MODERATOR
  // (requirement #12 "do not simply give ADMIN all Super Admin permissions")
  // - a Super Admin/Normal Admin explicitly grants more via the Roles page
  // or a per-user permission override.
  const roleSeeds = [
    {
      slug: ROLE_SLUGS.SUPER_ADMIN,
      name: "Super Admin",
      description: "Full system access. Bypasses standard permission checks.",
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
      permissions: {
        [CORE_RESOURCES.USERS]: { ...empty, view: true, edit: true },
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, edit: true },
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
      },
    },
    {
      slug: ROLE_SLUGS.NORMAL_ADMIN,
      name: "Normal Admin",
      description: "Manages its own Moderator users in a scope separate from Super Admin / Admin.",
      permissions: {
        [CORE_RESOURCES.USERS]: { ...empty, view: true, add: true, edit: true },
        [CORE_RESOURCES.COMMENTS]: { ...empty, view: true, edit: true, delete: true },
        [CORE_RESOURCES.REPORTS]: viewOnly,
        [CORE_RESOURCES.DASHBOARD]: viewOnly,
        // Core to being a Normal Admin, not something extra to grant -
        // mirrors Super Admin's inherent (bypassed) ability to assign
        // permissions to Admin (requirement #9).
        [CORE_RESOURCES.PERMISSIONS]: { ...empty, view: true, edit: true },
      },
    },
    {
      slug: ROLE_SLUGS.MODERATOR,
      name: "Moderator",
      description: "Operates in the Normal Admin / Moderator area under explicitly assigned permissions.",
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
      { name: seed.name, slug: seed.slug, description: seed.description, isSystem: true, isActive: true, permissions: seed.permissions },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log("Seeded roles:", Object.keys(roleDocs).join(", "));

  // --- Sanity check: DEFAULT_USER_ROLE_SLUG must exist before registration works.
  if (DEFAULT_USER_ROLE_SLUG !== ROLE_SLUGS.CUSTOMER) {
    throw new Error("DEFAULT_USER_ROLE_SLUG is out of sync with ROLE_SLUGS.CUSTOMER.");
  }

  // --- 5 demo users, one per role (requirement #11). Super Admin keeps the
  // existing env-driven contract; the other 4 are dev-only fixed accounts
  // sharing DEMO_PASSWORD (documented in README). All idempotent by email.
  async function ensureUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleSlug: string;
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
  });

  const normalAdmin = await ensureUser({
    email: "normaladmin@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "NormalAdmin",
    roleSlug: ROLE_SLUGS.NORMAL_ADMIN,
  });

  // Ownership: this demo moderator is managed by the demo normal-admin
  // (requirement #10) - NORMAL_ADMIN A/B ownership is what
  // canManageTargetUser() enforces at request time.
  await ensureUser({
    email: "moderator@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "Moderator",
    roleSlug: ROLE_SLUGS.MODERATOR,
    managedBy: normalAdmin._id as unknown as mongoose.Types.ObjectId,
  });

  await ensureUser({
    email: "customer@example.com",
    password: DEMO_PASSWORD,
    firstName: "Demo",
    lastName: "Customer",
    roleSlug: ROLE_SLUGS.CUSTOMER,
  });

  // --- SUPER_ADMIN / ADMIN scoped menu (requirement #7)
  const userMgmt = await MenuModel.findOneAndUpdate(
    { key: "user-management" },
    {
      name: "User Management",
      key: "user-management",
      label: "User Management",
      slug: "user-management",
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const usersMenu = await MenuModel.findOneAndUpdate(
    { key: "users" },
    {
      name: "Users",
      key: "users",
      label: "Users",
      slug: "users",
      parentId: userMgmt._id,
      level: 2,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "user",
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "user-list" },
    {
      name: "User List",
      key: "user-list",
      label: "User List",
      slug: "user-list",
      route: "/admin/users",
      parentId: usersMenu._id,
      level: 3,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "list",
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "roles" },
    {
      name: "Roles",
      key: "roles",
      label: "Roles",
      slug: "roles",
      route: "/admin/roles",
      parentId: userMgmt._id,
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
    { key: "menus" },
    {
      name: "Menus",
      key: "menus",
      label: "Menus",
      slug: "menus",
      route: "/admin/menus",
      parentId: null,
      level: 1,
      sortOrder: 2,
      isActive: true,
      isVisible: true,
      icon: "list-tree",
      resourceKey: CORE_RESOURCES.MENUS,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "permission-management" },
    {
      name: "Permission Management",
      key: "permission-management",
      label: "Permission Management",
      slug: "permission-management",
      route: "/admin/permissions",
      parentId: null,
      level: 1,
      sortOrder: 3,
      isActive: true,
      isVisible: true,
      icon: "key",
      // Gated on ROLES, not PERMISSIONS: the page it links to
      // (/admin/permissions) reads from GET /api/roles, which is itself
      // gated on ROLES view - keeping the menu's resourceKey in sync with
      // what the page actually calls avoids a visible-but-403 or
      // hidden-but-reachable mismatch.
      resourceKey: CORE_RESOURCES.ROLES,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

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

  // --- NORMAL_ADMIN / MODERATOR scoped menu (requirement #7) - a separate
  // 3-level tree from the one above, per requirement #4.
  const moderatorMgmt = await MenuModel.findOneAndUpdate(
    { key: "moderator-management" },
    {
      name: "Moderator Management",
      key: "moderator-management",
      label: "Moderator Management",
      slug: "moderator-management",
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "users",
      scope: MENU_SCOPES.NORMAL_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const moderatorsMenu = await MenuModel.findOneAndUpdate(
    { key: "moderators" },
    {
      name: "Moderators",
      key: "moderators",
      label: "Moderators",
      slug: "moderators",
      parentId: moderatorMgmt._id,
      level: 2,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "user",
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.NORMAL_ADMIN_MODERATOR,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await MenuModel.findOneAndUpdate(
    { key: "moderator-list" },
    {
      name: "Moderator List",
      key: "moderator-list",
      label: "Moderator List",
      slug: "moderator-list",
      route: "/normal-admin/users",
      parentId: moderatorsMenu._id,
      level: 3,
      sortOrder: 1,
      isActive: true,
      isVisible: true,
      icon: "list",
      resourceKey: CORE_RESOURCES.USERS,
      scope: MENU_SCOPES.NORMAL_ADMIN_MODERATOR,
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
      route: "/normal-admin/comments",
      parentId: null,
      level: 1,
      sortOrder: 2,
      isActive: true,
      isVisible: true,
      icon: "message-square",
      resourceKey: CORE_RESOURCES.COMMENTS,
      scope: MENU_SCOPES.NORMAL_ADMIN_MODERATOR,
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
      route: "/normal-admin/reports",
      parentId: null,
      level: 1,
      sortOrder: 3,
      isActive: true,
      isVisible: true,
      icon: "bar-chart",
      resourceKey: CORE_RESOURCES.REPORTS,
      scope: MENU_SCOPES.NORMAL_ADMIN_MODERATOR,
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
