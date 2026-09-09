"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionLink, RowActionButton } from "@/components/data-table/row-action-item";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { UserLayer, PermissionMap } from "@/lib/permissions/constants";

export type RoleRow = {
  _id: string;
  name: string;
  slug: string;
  userLayer: UserLayer;
  isSystem: boolean;
  isActive: boolean;
  managedBy: string | null;
  permissions: PermissionMap;
};

/**
 * Roles section of the layer-tabbed management area. GET /api/roles already
 * returns only what the actor is scoped to see (every role for SUPER_ADMIN,
 * or the actor's own Moderator-layer roles for COMPANY_ADMIN - see
 * role.service.ts#listRolesForActor) - filtering the rest of the way down to
 * the SELECTED layer happens client-side since the full list is always small.
 */
export function RolesSection({
  layer,
  basePath,
  area,
  onRolesLoaded,
}: {
  layer: UserLayer;
  basePath: string;
  area: "admin" | "company-admin";
  /** Lets the sibling Menu/Permission section reuse this same fetch instead of re-requesting GET /api/roles. */
  onRolesLoaded?: (roles: RoleRow[]) => void;
}) {
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const roles = await apiClient.get<RoleRow[]>("/api/roles");
      setAllRoles(roles);
      onRolesLoaded?.(roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRolesLoaded is a stable callback ref from the parent, not reactive state
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  const rows = useMemo(() => allRoles.filter((r) => r.userLayer === layer), [allRoles, layer]);

  const columns: DataTableColumn<RoleRow>[] =
    area === "admin"
      ? [
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "slug", header: "Slug", render: (r) => r.slug },
          { key: "type", header: "Type", render: (r) => (r.isSystem ? "System" : "Custom") },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-success-soft text-success" : "bg-line text-ink-soft"}`}>
                {r.isActive ? "Active" : "Inactive"}
              </span>
            ),
          },
        ]
      : [
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "slug", header: "Slug", render: (r) => r.slug },
          { key: "owner", header: "Owner", render: (r) => (r.managedBy ? "You" : "Shared default") },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-success-soft text-success" : "bg-line text-ink-soft"}`}>
                {r.isActive ? "Active" : "Inactive"}
              </span>
            ),
          },
        ];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Roles</h2>
          <p className="text-sm text-ink-soft">Dynamic, permission-based roles assignable to this layer.</p>
        </div>
        <PermissionGuard resource="roles" action="add">
          <Link href={`${basePath}/new?layer=${layer}`}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add role
            </Button>
          </Link>
        </PermissionGuard>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r._id}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={load}
        emptyTitle="No roles yet"
        rowActions={(r) => {
          // Company-admin side: only the role's own owner may act on it (the
          // shared system default, managedBy: null, is view-only here - only
          // Super Admin manages it, like any other system role).
          if (area === "company-admin" && r.managedBy !== currentUserId) return null;
          return (
            <RowActionsMenu label={`Actions for ${r.name}`}>
              <PermissionGuard resource="roles" action="edit">
                <RowActionLink href={`${basePath}/${r._id}/edit?layer=${layer}`} icon={<Pencil className="h-4 w-4" />} label="Edit" />
              </PermissionGuard>
              {!r.isSystem && r.isActive && (
                <PermissionGuard resource="roles" action="delete">
                  <DeleteButton
                    itemLabel={r.name}
                    actionLabel="Deactivate"
                    onDelete={async () => {
                      await apiClient.delete(`/api/roles/${r._id}`);
                      await load();
                    }}
                    renderTrigger={(onClick) => (
                      <RowActionButton icon={<Trash2 className="h-4 w-4" />} label="Deactivate" variant="danger" onClick={onClick} />
                    )}
                  />
                </PermissionGuard>
              )}
            </RowActionsMenu>
          );
        }}
      />
    </section>
  );
}
