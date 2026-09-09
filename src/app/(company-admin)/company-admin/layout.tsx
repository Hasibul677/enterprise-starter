import type { ReactNode } from "react";
import { requireCompanyAdminAreaPage } from "@/lib/auth/route-guards";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

/**
 * COMPANY_ADMIN/MODERATOR dashboard tree - completely separate from (admin)
 * and (dashboard) (requirement #3/#4). Server-side gate:
 * requireCompanyAdminAreaPage() re-resolves access from the DB on every
 * request and redirects to /login (unauthenticated) or /dashboard
 * (authenticated but none of Super Admin/Company Admin/Moderator) before any
 * HTML here is rendered. Every page/action inside still independently
 * enforces its own requirePermission() and, for Users, its own ownership
 * scoping (managedBy) - this only proves the actor belongs in this
 * dashboard tree at all.
 */
export default async function CompanyAdminLayout({ children }: { children: ReactNode }) {
  await requireCompanyAdminAreaPage();
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
