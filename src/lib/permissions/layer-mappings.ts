import { SCOPE_RESOURCES } from "./role-hierarchy";
import { MENU_SCOPES, USER_LAYERS, type MenuScope, type UserLayer } from "./constants";

/**
 * Resource keys a role/permission editor should offer for a given user
 * layer - SUPER_ADMIN/ADMIN/CUSTOMER roles share one list, COMPANY_ADMIN/
 * MODERATOR roles share the other, mirroring the 2-value Menu.scope model
 * (SCOPE_RESOURCES in role-hierarchy.ts is the single source of truth this
 * derives from - never hand-maintained separately).
 */
export function resourceOptionsForLayer(layer: UserLayer): { key: string; label: string }[] {
  const keys =
    layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR
      ? SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR
      : SCOPE_RESOURCES.SUPER_ADMIN_ADMIN;
  return keys.map((key) => ({ key, label: key.replace(/_/g, " ") }));
}

/** Which Menu.scope value gates the sidebar for a given layer - the same 2-value model buildEffectiveMenuTree() uses, so SUPER_ADMIN/ADMIN share one menu set and COMPANY_ADMIN/MODERATOR share another. CUSTOMER has no scope of its own - only scope-less menus ever apply to it. */
export function menuScopeForLayer(layer: UserLayer): MenuScope | null {
  if (layer === USER_LAYERS.SUPER_ADMIN || layer === USER_LAYERS.ADMIN) return MENU_SCOPES.SUPER_ADMIN_ADMIN;
  if (layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR)
    return MENU_SCOPES.COMPANY_ADMIN_MODERATOR;
  return null;
}
