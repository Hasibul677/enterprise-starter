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
import { SUPER_ADMIN_ROLE_SLUG, DEFAULT_USER_ROLE_SLUG, CORE_RESOURCES } from "@/lib/permissions/constants";

async function main() {
  const env = getEnv();
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB for seeding.");

  const fullPerms = { view: true, add: true, edit: true, delete: true };
  const viewOnly = { view: true, add: false, edit: false, delete: false };

  const superAdminRole = await RoleModel.findOneAndUpdate(
    { slug: SUPER_ADMIN_ROLE_SLUG },
    {
      name: "Super Admin",
      slug: SUPER_ADMIN_ROLE_SLUG,
      description: "Full system access. Bypasses standard permission checks.",
      isSystem: true,
      isActive: true,
      permissions: {
        [CORE_RESOURCES.USERS]: fullPerms,
        [CORE_RESOURCES.ROLES]: fullPerms,
        [CORE_RESOURCES.MENUS]: fullPerms,
        [CORE_RESOURCES.AUDIT_LOG]: viewOnly,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const viewerRole = await RoleModel.findOneAndUpdate(
    { slug: DEFAULT_USER_ROLE_SLUG },
    {
      name: "Viewer",
      slug: DEFAULT_USER_ROLE_SLUG,
      description: "Default role granted to new public registrations. Minimal read access.",
      isSystem: true,
      isActive: true,
      permissions: {
        [CORE_RESOURCES.USERS]: { view: false, add: false, edit: false, delete: false },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log("Seeded roles:", superAdminRole.slug, viewerRole.slug);

  const existingSuperAdmin = await UserModel.findOne({ email: env.SUPER_ADMIN_EMAIL.toLowerCase() });
  if (!existingSuperAdmin) {
    const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);
    await UserModel.create({
      firstName: "Super",
      lastName: "Admin",
      email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      roles: [superAdminRole._id],
      status: "ACTIVE",
      emailVerified: true,
    });
    console.log("Created Super Admin account:", env.SUPER_ADMIN_EMAIL);
  } else {
    console.log("Super Admin account already exists, skipping.");
  }

  // --- Starter 3-level menu ---
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
      resourceKey: CORE_RESOURCES.USERS,
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
      resourceKey: CORE_RESOURCES.USERS,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const rolesMenu = await MenuModel.findOneAndUpdate(
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
      resourceKey: CORE_RESOURCES.ROLES,
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
      resourceKey: CORE_RESOURCES.MENUS,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  void rolesMenu;
  console.log("Seeded starter 3-level menu.");

  await mongoose.disconnect();
  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
