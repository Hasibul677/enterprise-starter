/**
 * Centralized, strongly-typed permission model.
 * Every resource module (users, roles, menus, and every FUTURE business
 * module: products, orders, inventory, ...) is represented here instead of
 * scattering permission strings across the codebase.
 */

export const PERMISSION_ACTIONS = ["view", "add", "edit", "delete", "comment"] as const;
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
 * The 5 fixed roles the RBAC hierarchy is built around (see
 * src/lib/permissions/role-hierarchy.ts for assignment/management
 * authority). The Role collection stays generic/DB-driven - nothing stops a
 * future custom role slug from being added via the Roles admin UI - but the
 * hierarchy engine only ever grants special authority to these 5 slugs.
 */
export const ROLE_SLUGS = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  NORMAL_ADMIN: "normal-admin",
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
  NORMAL_ADMIN_MODERATOR: "normal_admin_moderator",
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
