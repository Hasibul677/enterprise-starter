import { redirect } from "next/navigation";
import { resolveCurrentAccess, type ResolvedAccess } from "./current-user";

/**
 * Server-side page guards for use in layout.tsx/page.tsx Server Components -
 * the same DB-backed resolveCurrentAccess() the API routes use, just wired
 * to redirect() instead of throwing, since a layout can't return an
 * ApiResponse. This is the authoritative check for page access: proxy.ts is
 * a fast-path in front of it, never a replacement for it.
 */
export async function requireAuthenticatedPage(): Promise<ResolvedAccess> {
  try {
    return await resolveCurrentAccess();
  } catch {
    redirect("/login");
  }
}

export async function requireSuperAdminPage(): Promise<ResolvedAccess> {
  const access = await requireAuthenticatedPage();
  if (!access.isSuperAdmin) {
    redirect("/dashboard");
  }
  return access;
}
