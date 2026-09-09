import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { canCreateUserInLayer } from "@/lib/permissions/role-hierarchy";
import { USER_LAYER_VALUES, USER_LAYERS } from "@/lib/permissions/constants";
import type { UserLayer } from "@/lib/permissions/constants";
import { roleRepository } from "@/repositories/role.repository";
import { ok, fail, handleRouteError } from "@/lib/api/response";

/**
 * Minimal role-picker data source for user-creation forms (requirement #5/
 * #8/#9): returns only {_id, name, slug} for the roles the CURRENT actor is
 * authorized to assign a NEW user of `?layer=` as. Deliberately NOT gated on
 * requirePermission(ROLES, "view"): a COMPANY_ADMIN can never reach GET
 * /api/roles at all today unless it also holds `roles.view`, and this
 * endpoint exists specifically so a "Create User" form works for every actor
 * allowed to create a user at all, without widening access to the full role
 * management surface.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);

    const layer = request.nextUrl.searchParams.get("layer") as UserLayer | null;
    if (!layer || !USER_LAYER_VALUES.includes(layer)) {
      return fail(422, "VALIDATION_ERROR", "A valid target 'layer' query parameter is required.");
    }

    const actorLayer: UserLayer = access.isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : access.userLayer;
    if (!canCreateUserInLayer(actorLayer, layer)) {
      return ok([]); // not authorized to create in this layer at all - no roles to offer, not an error
    }

    const roles =
      layer === USER_LAYERS.MODERATOR
        ? await roleRepository.findAssignableForModeratorLayerOwner(String(access.user._id))
        : await roleRepository.findByUserLayer(layer);

    const data = roles.map((r) => ({ _id: String(r._id), name: r.name, slug: r.slug }));
    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
