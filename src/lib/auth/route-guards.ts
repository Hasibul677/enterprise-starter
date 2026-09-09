import { redirect } from "next/navigation";
import { resolveCurrentAccess, type ResolvedAccess } from "./current-user";
import { isAdminAreaLayer, isCompanyAdminAreaLayer } from "@/lib/permissions/role-hierarchy";

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

/** Server-side gate for the shared SUPER_ADMIN/ADMIN dashboard tree (`/admin/**`). */
export async function requireAdminAreaPage(): Promise<ResolvedAccess> {
  const access = await requireAuthenticatedPage();
  if (!access.isSuperAdmin && !isAdminAreaLayer(access.userLayer)) {
    redirect("/dashboard");
  }
  return access;
}

/** Server-side gate for the shared COMPANY_ADMIN/MODERATOR dashboard tree (`/company-admin/**`). */
export async function requireCompanyAdminAreaPage(): Promise<ResolvedAccess> {
  const access = await requireAuthenticatedPage();
  if (!access.isSuperAdmin && !isCompanyAdminAreaLayer(access.userLayer)) {
    redirect("/dashboard");
  }
  return access;
}
