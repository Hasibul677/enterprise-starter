/**
 * Centralized, strongly-typed permission model.
 * Every resource module (users, roles, menus, and every FUTURE business
 * module: products, orders, inventory, ...) is represented here instead of
 * scattering permission strings across the codebase.
 */

/**
 * `login_as` gates the "Login as User" (impersonation) capability - it only
 * has real meaning on the USERS resource (see guard.ts
 * requireImpersonationActor(), which checks `hasPermission(permissions,
 * CORE_RESOURCES.USERS, "login_as")` for an ADMIN actor), exactly the same
 * way `comment` only has real meaning on the COMMENTS resource - both are
 * still defined globally here because every resource shares one
 * ResourcePermissions shape (PermissionMatrix renders one column per action
 * for every resource row); an inert `login_as`/`comment` checkbox on an
 * unrelated resource is simply never consulted by anything. There is
 * deliberately NO separate "impersonation" resource - impersonation is a
 * capability OF Users, not its own menu/module.
 */
export const PERMISSION_ACTIONS = ["view", "add", "edit", "delete", "comment", "login_as"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * Built-in resource keys shipped with the foundation.
 * Extend this (or better: make it DB/config-driven per module) as new
 * business modules are added - it is intentionally just a string so new
 * modules never require touching core auth/permission code.
 */
export const CORE_RESOURCES = {
  USERS: "users",
  ROLES: "roles",
  MENUS: "menus",
  AUDIT_LOG: "audit_log",
  PERMISSIONS: "permissions",
  COMMENTS: "comments",
  REPORTS: "reports",
  SETTINGS: "settings",
  DASHBOARD: "dashboard",
} as const;

export type ResourceKey = string;

/**
 * The exactly-5, structurally fixed user hierarchy layers (never grows or
 * shrinks - see src/lib/permissions/role-hierarchy.ts). This is the ONLY
 * field hierarchy/authority decisions ever read. It is deliberately separate
 * from Role/ROLE_SLUGS below: a Role is just a dynamic, unlimited permission
 * bundle that TARGETS one of these layers (Role.userLayer) - creating a role
 * never creates a new layer, and a role's name/slug carries no authority.
 */
export const USER_LAYERS = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  COMPANY_ADMIN: "COMPANY_ADMIN",
  MODERATOR: "MODERATOR",
  CUSTOMER: "CUSTOMER",
} as const;

export type UserLayer = (typeof USER_LAYERS)[keyof typeof USER_LAYERS];
export const USER_LAYER_VALUES = Object.values(USER_LAYERS) as [UserLayer, ...UserLayer[]];

/**
 * The 5 seeded DEFAULT roles, one per user layer (see src/scripts/seed.ts).
 * Unlike USER_LAYERS, this is NOT an authority source - it only identifies
 * which Role document to fall back to (e.g. public registration's default
 * Customer role). SUPER_ADMIN/COMPANY_ADMIN can create unlimited additional
 * roles targeting the applicable layers; those roles have no fixed slug.
 */
export const ROLE_SLUGS = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  COMPANY_ADMIN: "company-admin",
  MODERATOR: "moderator",
  CUSTOMER: "customer",
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

/**
 * A Menu row managed through the Menu admin UI must declare which
 * dashboard tree it belongs to (requirement #7). `null`/undefined is only
 * used for the handful of menu rows that live outside that system entirely
 * (e.g. the customer "Dashboard" link) - see menu.model.ts.
 */
export const MENU_SCOPES = {
  SUPER_ADMIN_ADMIN: "super_admin_admin",
  COMPANY_ADMIN_MODERATOR: "company_admin_moderator",
} as const;

export type MenuScope = (typeof MENU_SCOPES)[keyof typeof MENU_SCOPES];
export const MENU_SCOPE_VALUES = Object.values(MENU_SCOPES);

export type ResourcePermissions = Record<PermissionAction, boolean>;

export type PermissionMap = Record<ResourceKey, ResourcePermissions>;

export const EMPTY_RESOURCE_PERMISSIONS: ResourcePermissions = {
  view: false,
  add: false,
  edit: false,
  delete: false,
  comment: false,
  login_as: false,
};

/**
 * Default resource permissions granted to the CUSTOMER role that every
 * public registration is assigned (see registerUser() /
 * DEFAULT_USER_ROLE_SLUG). Comment is opted in by default for customers;
 * restricted/admin roles never get it unless an admin explicitly checks it
 * in the Role/Permission management UI.
 */
export const NORMAL_USER_DEFAULT_RESOURCE_PERMISSIONS: ResourcePermissions = {
  ...EMPTY_RESOURCE_PERMISSIONS,
  comment: true,
};

export const SUPER_ADMIN_ROLE_SLUG: RoleSlug = ROLE_SLUGS.SUPER_ADMIN;
export const DEFAULT_USER_ROLE_SLUG: RoleSlug = ROLE_SLUGS.CUSTOMER;
