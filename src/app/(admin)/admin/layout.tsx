import type { ReactNode } from "react";
import { requireAdminAreaPage } from "@/lib/auth/route-guards";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

/**
 * SUPER_ADMIN/ADMIN dashboard tree - completely separate from
 * (company-admin) and (dashboard). Server-side gate: requireAdminAreaPage()
 * re-resolves access from the DB on every request and redirects to /login
 * (unauthenticated) or /dashboard (authenticated but neither Super Admin
 * nor Admin) before any admin HTML is rendered. This only proves the actor
 * belongs in this dashboard tree at all - every page/action inside still
 * independently enforces its own requirePermission() (requirement #3).
 * This is the authoritative check; proxy.ts only fast-paths the same
 * decision earlier in the request lifecycle, it never replaces this.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminAreaPage();
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
