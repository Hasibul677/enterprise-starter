import { Schema } from "mongoose";
import { PERMISSION_ACTIONS } from "@/lib/permissions/constants";

/**
 * Shared `{ view, add, edit, delete, comment, login_as }` sub-schema used
 * both by Role.permissions (the role-wide baseline) and
 * User.permissionOverrides (per-user grants layered on top of it) - see
 * current-user.ts, which unions both the same way mergeRolePermissions()
 * unions multiple roles. `login_as` only has real meaning on the USERS
 * resource entry (it gates "Login as User" impersonation - see
 * guard.ts#requireImpersonationActor()); there is no separate
 * "impersonation" resource.
 */
export const resourcePermissionSchema = new Schema(
  {
    view: { type: Boolean, default: false },
    add: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    comment: { type: Boolean, default: false },
    login_as: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Validates that any key added to the Map only ever contains the known
 * actions. By the time a Mongoose validator runs, `value`'s entries have
 * already been cast to `resourcePermissionSchema` SUBDOCUMENTS, not plain
 * objects - `Object.keys()` on one of those returns Mongoose's own internal
 * properties (`$__`, `_doc`, ...), not the schema's fields, so it must be
 * unwrapped via `.toObject()` first or every non-empty map fails validation.
 */
export function validatePermissionMap(
  value: Map<string, Record<string, boolean> | { toObject(): Record<string, boolean> }>
) {
  for (const perms of value.values()) {
    const plain =
      typeof (perms as { toObject?: unknown }).toObject === "function"
        ? (perms as { toObject(): Record<string, boolean> }).toObject()
        : (perms as Record<string, boolean>);
    const keys = Object.keys(plain);
    if (!keys.every((k) => (PERMISSION_ACTIONS as readonly string[]).includes(k))) {
      return false;
    }
  }
  return true;
}
