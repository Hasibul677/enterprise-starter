import { SCOPE_RESOURCES } from "./role-hierarchy";
import { CORE_RESOURCES, MENU_SCOPES, USER_LAYERS, type MenuScope, type UserLayer } from "./constants";
import type { PermissionMatrixResource } from "@/components/permission/permission-matrix";

/**
 * Resource keys a role/permission editor should offer for a given user
 * layer - SUPER_ADMIN/ADMIN/CUSTOMER roles share one list, COMPANY_ADMIN/
 * MODERATOR roles share the other, mirroring the 2-value Menu.scope model
 * (SCOPE_RESOURCES in role-hierarchy.ts is the single source of truth this
 * derives from - never hand-maintained separately).
 *
 * `login_as` (PermissionMatrix's "Login as" column) is only ever a real
 * capability of the USERS resource specifically, and even then only for an
 * ADMIN-layer role/user (see guard.ts requireImpersonationActor()) - every
 * OTHER resource (Roles, Menus, Settings, ...) always hides it, and Users
 * itself only shows it when `layer === ADMIN`. When nothing in the table
 * applies it at all (any layer other than ADMIN), PermissionMatrix drops
 * the whole column rather than rendering an empty, unusable one - that's
 * what keeps `login_as` off Company Admin/Moderator (and Super Admin/
 * Customer) role management, even though it's otherwise a plain global
 * PermissionAction shared by every resource's ResourcePermissions shape.
 */
export function resourceOptionsForLayer(layer: UserLayer): PermissionMatrixResource[] {
  const keys =
    layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR
      ? SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR
      : SCOPE_RESOURCES.SUPER_ADMIN_ADMIN;
  const loginAsApplicable = layer === USER_LAYERS.ADMIN;
  return keys.map((key) => ({
    key,
    label: key.replace(/_/g, " "),
    hiddenActions: key === CORE_RESOURCES.USERS && loginAsApplicable ? undefined : ["login_as"],
  }));
}

/** Which Menu.scope value gates the sidebar for a given layer - the same 2-value model buildEffectiveMenuTree() uses, so SUPER_ADMIN/ADMIN share one menu set and COMPANY_ADMIN/MODERATOR share another. CUSTOMER has no scope of its own - only scope-less menus ever apply to it. */
export function menuScopeForLayer(layer: UserLayer): MenuScope | null {
  if (layer === USER_LAYERS.SUPER_ADMIN || layer === USER_LAYERS.ADMIN) return MENU_SCOPES.SUPER_ADMIN_ADMIN;
  if (layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR)
    return MENU_SCOPES.COMPANY_ADMIN_MODERATOR;
  return null;
}
