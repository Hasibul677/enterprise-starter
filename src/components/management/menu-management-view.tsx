"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { LAYER_LABELS } from "@/components/users/user-create-dialog";
import { MenuCreateDialog } from "@/components/management/menu-create-dialog";
import { MenuListView, type MenuRow } from "@/components/menus/menu-list-view";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { menuScopeForLayer } from "@/lib/permissions/layer-mappings";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";

const LAYER_ORDER: UserLayer[] = [
  USER_LAYERS.SUPER_ADMIN,
  USER_LAYERS.ADMIN,
  USER_LAYERS.COMPANY_ADMIN,
  USER_LAYERS.MODERATOR,
  USER_LAYERS.CUSTOMER,
];

/** Whether a menu item is shown under the given layer's tab - the same
 * scope mapping buildEffectiveMenuTree()/canSeeScope() use for real sidebar
 * visibility (menuScopeForLayer(): SUPER_ADMIN & ADMIN share one scope,
 * COMPANY_ADMIN & MODERATOR share the other, CUSTOMER has none). Menu.scope
 * itself can't distinguish further within a pair - e.g. the SUPER_ADMIN and
 * ADMIN tabs necessarily show the identical set of admin-area menus - this
 * is the tab UI reflecting that existing 2-value scope model, not a new
 * authority split. */
function matchesLayer(menu: MenuRow, layer: UserLayer): boolean {
  return (menu.scope ?? null) === (menuScopeForLayer(layer) ?? null);
}

/**
 * Standalone Menus CRUD page - admin-only (menus/[id]/route.ts gates every
 * mutation on requireAdminAreaAccess(), and only Super Admin's default role
 * is seeded with the `menus` resource permission - see seed.ts). Companion
 * to the Users page's untouched "Add menu" quick action. Tab UI mirrors
 * role-management-view.tsx: fetch once, derive which of the 5 fixed layers
 * actually have menus, and filter client-side rather than re-fetching per
 * tab (GET /api/menus has no scope query param).
 */
export function MenuManagementView() {
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  // Only holds an explicit user tab click - the actually-active tab is
  // derived below (`layer`), never synced back into this via an effect, so
  // switching to a layer that later disappears from `presentLayers` (e.g.
  // after a reload) just falls back to the first present layer on its own.
  const [selectedLayer, setSelectedLayer] = useState<UserLayer>();
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const data = await apiClient.get<MenuRow[]>("/api/menus");
      setMenus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menus.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  const presentLayers = useMemo(() => LAYER_ORDER.filter((l) => menus.some((m) => matchesLayer(m, l))), [menus]);

  const layer = selectedLayer && presentLayers.includes(selectedLayer) ? selectedLayer : presentLayers[0];
  const rowsForLayer = layer ? menus.filter((m) => matchesLayer(m, layer)) : menus;

  const menuById = useMemo(() => new Map(menus.map((m) => [m._id, m])), [menus]);
  const menuByIdLabel = useCallback(
    (id: string | null) => (id ? (menuById.get(id)?.label ?? "—") : "Top level"),
    [menuById]
  );

  return (
    <ContentContainer>
      <PageHeader
        title="Menus"
        description="The 3-level navigation hierarchy shown in the sidebar, per user layer."
        actions={
          <PermissionGuard resource="menus" action="add">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add menu
            </Button>
          </PermissionGuard>
        }
      />
      {presentLayers.length > 1 && layer && (
        <Tabs
          items={presentLayers.map((l) => ({ value: l, label: LAYER_LABELS[l] }))}
          value={layer}
          onChange={setSelectedLayer}
        />
      )}
      <MenuListView
        rows={rowsForLayer}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={load}
        onChanged={load}
        menuByIdLabel={menuByIdLabel}
      />
      <MenuCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          load();
        }}
        layer={layer ?? USER_LAYERS.SUPER_ADMIN}
      />
    </ContentContainer>
  );
}
