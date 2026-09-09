import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Cheap polling endpoint for use-permission-sync.ts - deliberately returns
 * only the two fields a client needs to decide whether to do a full
 * GET /api/auth/me refresh, instead of recomputing the permission map and
 * menu tree on every ~20s tick. Goes through the exact same
 * resolveCurrentAccess() every other protected route uses, so a
 * forced-logout condition (disabled/blocked/tokenVersion mismatch) surfaces
 * here identically to any other request.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    return ok({
      status: access.user.status,
      permissionVersion: access.user.permissionVersion,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
