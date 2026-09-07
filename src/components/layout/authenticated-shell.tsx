"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Loading } from "@/components/feedback/loading";
import { Alert } from "@/components/feedback/alert";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client/api-client";

/**
 * Shared client-side shell for both authenticated dashboard trees
 * ((dashboard) for Normal Users, (admin) for Super Admin). This only
 * hydrates the Zustand UI cache (name, menus, permission flags for
 * show/hide UX) and reacts to logout - it grants no access. The actual
 * route access decision already happened server-side, in the Server
 * Component layout that renders this (see requireAuthenticatedPage() /
 * requireSuperAdminPage() in src/lib/auth/route-guards.ts), before any of
 * this component's HTML was ever sent to the browser.
 */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const hydrated = useAuthStore((s) => s.hydrated);
  const warning = useAuthStore((s) => s.warning);
  const [failed, setFailed] = useState(false);

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
      {warning && (
        <div className="border-b border-warning/30 bg-warning-soft px-6 py-2">
          <Alert variant="warning">Your account has a warning flag. Contact an administrator if you believe this is in error.</Alert>
        </div>
      )}
      {children}
    </AppShell>
  );
}
