import type { ReactNode } from "react";
import { requireSuperAdminPage } from "@/lib/auth/route-guards";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

/**
 * Super Admin dashboard tree - completely separate from (dashboard).
 * Server-side gate: requireSuperAdminPage() re-resolves access from the DB
 * on every request and redirects to /login (unauthenticated) or /dashboard
 * (authenticated but not Super Admin) before any admin HTML is rendered.
 * This is the authoritative check; proxy.ts only fast-paths the same
 * decision earlier in the request lifecycle, it never replaces this.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdminPage();
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
