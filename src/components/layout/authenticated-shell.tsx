"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Loading } from "@/components/feedback/loading";
import { Alert } from "@/components/feedback/alert";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client/api-client";
import { useTrackClientNavigation } from "@/components/navigation/back-button";

function roleLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Persistent impersonation indicator (requirement #21) - rendered inside
 * AuthenticatedShell so it's guaranteed to show on every page of every
 * dashboard tree, exactly like the account-warning banner below it, and
 * can never be mistaken for a normal login.
 */
function ImpersonationBanner() {
  const user = useAuthStore((s) => s.user);
  const roleSlugs = useAuthStore((s) => s.roleSlugs);
  const [ending, setEnding] = useState(false);

  async function handleReturn() {
    setEnding(true);
    try {
      const { redirectTo } = await apiClient.post<{ redirectTo: string }>("/api/auth/impersonate/end");
      // Hard navigation, not router.push: guarantees a fully clean reload of
      // every client-side auth/menu/permission cache for the restored
      // Super Admin session, with nothing left over from the impersonated one.
      window.location.href = redirectTo;
    } catch {
      setEnding(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning-soft px-6 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium text-warning">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        You are currently logged in as {user ? `${user.firstName} ${user.lastName}` : "another user"}
        {roleSlugs.length > 0 && <span className="font-normal">· Role: {roleSlugs.map(roleLabel).join(", ")}</span>}
      </span>
      <Button size="sm" variant="secondary" onClick={handleReturn} loading={ending}>
        Return to Super Admin
      </Button>
    </div>
  );
}

/**
 * Shared client-side shell for all 3 authenticated dashboard trees
 * ((dashboard) for Customer, (admin) for Super Admin/Admin, (normal-admin)
 * for Normal Admin/Moderator). This only hydrates the Zustand UI cache
 * (name, menus, permission flags for show/hide UX) and reacts to logout -
 * it grants no access. The actual route access decision already happened
 * server-side, in the Server Component layout that renders this (see
 * requireAuthenticatedPage() / requireAdminAreaPage() /
 * requireNormalAdminAreaPage() in src/lib/auth/route-guards.ts), before any
 * of this component's HTML was ever sent to the browser.
 */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const hydrated = useAuthStore((s) => s.hydrated);
  const warning = useAuthStore((s) => s.warning);
  const isImpersonating = useAuthStore((s) => s.isImpersonating);
  const [failed, setFailed] = useState(false);

  useTrackClientNavigation();

  useEffect(() => {
    function onLogout() {
      clearSession();
      router.push("/login");
    }
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, [clearSession, router]);

  useEffect(() => {
    apiClient
      .get("/api/auth/me")
      .then((data) => setSession(data as never))
      .catch(() => {
        setFailed(true);
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated && !failed) {
    return <Loading label="Loading your workspace..." />;
  }

  return (
    <AppShell>
      {isImpersonating && <ImpersonationBanner />}
      {warning && (
        <div className="border-b border-warning/30 bg-warning-soft px-6 py-2">
          <Alert variant="warning">Your account has a warning flag. Contact an administrator if you believe this is in error.</Alert>
        </div>
      )}
      {children}
    </AppShell>
  );
}
