import type { ReactNode } from "react";
import { requireAuthenticatedPage } from "@/lib/auth/route-guards";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

/**
 * Normal User dashboard tree. Server-side gate: any authenticated,
 * non-disabled/blocked user (Super Admin included) - not permission or
 * role restricted beyond "is logged in". This runs on the server before
 * any HTML reaches the browser, so it cannot be bypassed by disabling JS,
 * editing client state, or hitting the URL directly.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedPage();
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
