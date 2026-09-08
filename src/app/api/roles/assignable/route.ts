import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { CREATABLE_ROLES_BY } from "@/lib/permissions/role-hierarchy";
import { roleRepository } from "@/repositories/role.repository";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Minimal role-picker data source for user-creation forms (requirement #8):
 * returns only {_id, name, slug} for the roles the CURRENT actor is
 * authorized to assign (per role-hierarchy.ts CREATABLE_ROLES_BY) - never
 * full Role documents/permission maps. Deliberately NOT gated on
 * requirePermission(ROLES, "view"): a NORMAL_ADMIN can never reach GET
 * /api/roles at all (admin-area only), and an ADMIN without an explicit
 * `roles.view` grant would 403 there too, which would silently break their
 * own "Add user" page since it needs a role id to submit. This endpoint
 * exists specifically so that create-user forms work for every actor who
 * is allowed to create a user at all, without widening access to the full
 * role management surface.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);

    // No isSuperAdmin special-case: `access.roleSlugs` always includes
    // `super-admin` when `isSuperAdmin` is true (see current-user.ts), and
    // CREATABLE_ROLES_BY[SUPER_ADMIN] already lists exactly ADMIN/
    // NORMAL_ADMIN/CUSTOMER - the same table every other actor uses.
    const assignableSlugs = Array.from(new Set(access.roleSlugs.flatMap((slug) => CREATABLE_ROLES_BY[slug] ?? [])));

    const roles = assignableSlugs.length > 0 ? await roleRepository.findBySlugs(assignableSlugs) : [];
    const data = roles.map((r) => ({ _id: String(r._id), name: r.name, slug: r.slug }));

    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
