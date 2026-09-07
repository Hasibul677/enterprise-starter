/**
 * Centralized, strongly-typed permission model.
 * Every resource module (users, roles, menus, and every FUTURE business
 * module: products, orders, inventory, ...) is represented here instead of
 * scattering permission strings across the codebase.
 */

export const PERMISSION_ACTIONS = ["view", "add", "edit", "delete"] as const;
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
} as const;

export type ResourceKey = string;

export type ResourcePermissions = Record<PermissionAction, boolean>;

export type PermissionMap = Record<ResourceKey, ResourcePermissions>;

export const EMPTY_RESOURCE_PERMISSIONS: ResourcePermissions = {
  view: false,
  add: false,
  edit: false,
  delete: false,
};

export const SUPER_ADMIN_ROLE_SLUG = "super-admin";
export const DEFAULT_USER_ROLE_SLUG = "viewer";
