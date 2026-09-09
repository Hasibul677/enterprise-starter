"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore, type SessionUser, type MenuTreeNode } from "@/stores/auth-store";
import { getDefaultLandingRoute } from "@/lib/permissions/role-hierarchy";
import { flattenMenuRoutes, findOwningRoute } from "@/lib/permissions/route-match";
import type { PermissionMap, UserLayer } from "@/lib/permissions/constants";

const POLL_INTERVAL_MS = 20_000;

// A forced status/role/session change (bumps tokenVersion, not just
// permissionVersion) isn't proactively detected anywhere else today - an
// open tab would only find out the next time it happened to make an
// unrelated API call. Piggybacking the check here closes that gap too,
// reusing the exact same "auth:logout" event AuthenticatedShell already
// listens for.
const FORCE_LOGOUT_CODES = new Set([
  "TOKEN_VERSION_MISMATCH",
  "ACCOUNT_DISABLED",
  "ACCOUNT_BLOCKED",
  "USER_NOT_FOUND",
  "NO_ACCESS_TOKEN",
  "ACCESS_TOKEN_INVALID",
]);

type SessionStateResponse = { status: string; permissionVersion: number };

type MeResponse = {
  user: SessionUser;
  permissions: PermissionMap;
  isSuperAdmin: boolean;
  userLayer: UserLayer;
  roleSlugs: string[];
  menus: MenuTreeNode[];
  warning: boolean;
  isImpersonating?: boolean;
  permissionVersion?: number;
};

/**
 * Detects permission/menu changes an administrator makes while this tab
 * stays open, without requiring logout/login or a manual refresh. Polls a
 * cheap endpoint on an interval and whenever the tab regains focus; on a
 * version mismatch it refetches the full session and updates the store -
 * which alone is enough for an action-permission-only change, since
 * <PermissionGuard>/usePermission already read reactively from it - and
 * only navigates away + calls `onAccessRevoked` when the page the user is
 * currently on lost the menu/route access backing it.
 */
export function usePermissionSync(onAccessRevoked: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const inFlight = useRef(false);

  // `check()` can still be awaiting a response when the user client-side
  // navigates. A value captured by the closure at the moment the interval/
  // listener fired would go stale, and the redirect decision would land on
  // whatever page they've since moved to instead of the one this tick was
  // actually evaluating - so read the CURRENT pathname through a ref at the
  // point of decision, not the `pathname` argument the closure captured.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const check = useCallback(async () => {
    if (inFlight.current || document.hidden) return;
    // Skip until the initial GET /api/auth/me hydration (in AuthenticatedShell)
    // has landed, so this never races it with a redundant duplicate fetch.
    if (!useAuthStore.getState().hydrated) return;
    inFlight.current = true;
    try {
      const state = await apiClient.get<SessionStateResponse>("/api/auth/session-state");
      const { permissionVersion, menus, setSession } = useAuthStore.getState();
      if (state.permissionVersion === permissionVersion) return;

      const oldRoutes = flattenMenuRoutes(menus);
      const fresh = await apiClient.get<MeResponse>("/api/auth/me");
      setSession(fresh);

      const owningRoute = findOwningRoute(pathnameRef.current, oldRoutes);
      if (owningRoute && !flattenMenuRoutes(fresh.menus).includes(owningRoute)) {
        router.push(getDefaultLandingRoute(fresh));
        onAccessRevoked();
      }
    } catch (err) {
      if (err instanceof ApiClientError && FORCE_LOGOUT_CODES.has(err.code)) {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
      // Otherwise: transient/network failure - stay silent, retry next tick.
    } finally {
      inFlight.current = false;
    }
  }, [router, onAccessRevoked]);

  useEffect(() => {
    const interval = setInterval(check, POLL_INTERVAL_MS);
    function onVisible() {
      if (!document.hidden) check();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);
}
