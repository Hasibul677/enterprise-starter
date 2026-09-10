"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { LAYER_LABELS } from "@/components/users/user-create-dialog";
import { RoleCreateDialog } from "@/components/management/role-create-dialog";
import { RoleListView, type RoleRow } from "@/components/roles/role-list-view";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { CREATABLE_ROLE_LAYERS_BY } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";

const LAYER_ORDER: UserLayer[] = [
  USER_LAYERS.SUPER_ADMIN,
  USER_LAYERS.ADMIN,
  USER_LAYERS.COMPANY_ADMIN,
  USER_LAYERS.MODERATOR,
  USER_LAYERS.CUSTOMER,
];

/**
 * Standalone Roles CRUD page (companion to the Users page at
 * /admin|company-admin/management, which keeps its own "Add role" quick
 * action untouched). `GET /api/roles` already scopes the result server-side
 * (role.service.ts#listRolesForActor - Super Admin/read-only Admin see
 * every role, Company Admin only its own Moderator-layer roles), so this
 * fetches once and splits the response into layer tabs client-side rather
 * than re-fetching per tab.
 */
export function RoleManagementView({ area }: { area: "admin" | "company-admin" }) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const actorLayer = useAuthStore((s) => s.userLayer);
  const actorLayerForChecks = isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : actorLayer;

  const [roles, setRoles] = useState<RoleRow[]>([]);
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
      const data = await apiClient.get<RoleRow[]>("/api/roles");
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  const presentLayers = useMemo(() => {
    const present = new Set(roles.map((r) => r.userLayer));
    return LAYER_ORDER.filter((l) => present.has(l));
  }, [roles]);

  const layer = selectedLayer && presentLayers.includes(selectedLayer) ? selectedLayer : presentLayers[0];

  const canCreateInLayer = layer ? (CREATABLE_ROLE_LAYERS_BY[actorLayerForChecks] ?? []).includes(layer) : false;
  const rowsForLayer = layer ? roles.filter((r) => r.userLayer === layer) : [];

  return (
    <ContentContainer>
      <PageHeader
        title="Roles"
        description="Dynamic permission bundles targeting a fixed user layer."
        actions={
          canCreateInLayer && layer ? (
            <PermissionGuard resource="roles" action="add">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add role
              </Button>
            </PermissionGuard>
          ) : undefined
        }
      />
      {presentLayers.length > 1 && layer && (
        <Tabs
          items={presentLayers.map((l) => ({ value: l, label: LAYER_LABELS[l] }))}
          value={layer}
          onChange={setSelectedLayer}
        />
      )}
      <RoleListView
        rows={rowsForLayer}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={load}
        onChanged={load}
        emptyTitle="No roles found"
        emptyDescription={
          area === "admin" ? "Create a role to get started." : "Your custom Moderator roles will show up here."
        }
      />
      {layer && (
        <RoleCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
          layer={layer}
        />
      )}
    </ContentContainer>
  );
}
