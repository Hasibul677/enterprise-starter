"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/modal/dialog";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { apiClient } from "@/lib/api-client/api-client";
import { mergeRolePermissions, hasPermission } from "@/lib/permissions/merge";
import { menuScopeForLayer } from "@/lib/permissions/layer-mappings";
import { type UserLayer, type PermissionMap } from "@/lib/permissions/constants";

type MenuRow = {
  _id: string;
  name: string;
  route?: string | null;
  resourceKey?: string | null;
  isActive: boolean;
  isVisible: boolean;
  scope?: string | null;
  sortOrder: number;
};

type PermissionsResponse = { rolePermissions: PermissionMap; overrides: PermissionMap };

/**
 * Per-user, read-only "Menu Access" modal: which menu items this user can
 * currently see, derived the same way the Sidebar's buildEffectiveMenuTree()
 * decides visibility - scope match, active + visible, and (if resourceKey is
 * set) a `view` grant in the user's EFFECTIVE permissions (role baseline +
 * their own overrides, via the same /api/users/:id/permissions endpoint and
 * mergeRolePermissions() the Permissions dialog already uses). Informational
 * only - this never changes anything.
 */
export function UserMenuAccessDialog({
  open,
  onClose,
  userId,
  userLayer,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userLayer: UserLayer | null;
}) {
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [effective, setEffective] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches menu access each time the dialog opens for a new userId, not a render-time state sync
    setLoading(true);
    setError(undefined);
    Promise.all([
      apiClient.get<MenuRow[]>("/api/menus"),
      apiClient.get<PermissionsResponse>(`/api/users/${userId}/permissions`),
    ])
      .then(([allMenus, { rolePermissions, overrides }]) => {
        setMenus(allMenus);
        setEffective(
          mergeRolePermissions([
            { isActive: true, permissions: rolePermissions },
            { isActive: true, permissions: overrides },
          ])
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load menu access."))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const scope = userLayer ? menuScopeForLayer(userLayer) : null;
  const accessible = menus
    .filter((m) => m.isActive && m.isVisible && (m.scope ?? null) === scope)
    .filter((m) => !m.resourceKey || hasPermission(effective, m.resourceKey, "view"))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Menu access"
      description="Menus this user can currently see, based on their role and any permission overrides."
      className="max-w-lg"
    >
      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="rounded-lg border border-line bg-surface p-2">
          {accessible.length === 0 ? (
            <p className="p-4 text-sm text-ink-soft">No menus are currently visible to this user.</p>
          ) : (
            accessible.map((m) => (
              <div
                key={m._id}
                className="flex items-center justify-between border-b border-line px-2 py-2 last:border-0"
              >
                <span className="text-sm font-medium text-ink">{m.name}</span>
                {m.route && <span className="text-xs text-ink-soft">{m.route}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </Dialog>
  );
}
