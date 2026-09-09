"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionLink, RowActionButton } from "@/components/data-table/row-action-item";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { MENU_SCOPES, type UserLayer, USER_LAYERS } from "@/lib/permissions/constants";
import type { RoleRow } from "./roles-section";

type MenuRow = {
  _id: string;
  name: string;
  level: number;
  route?: string | null;
  resourceKey?: string | null;
  sortOrder: number;
  isActive: boolean;
  scope?: string | null;
};

const SCOPE_LABELS: Record<string, string> = {
  [MENU_SCOPES.SUPER_ADMIN_ADMIN]: "Super Admin / Admin",
  [MENU_SCOPES.COMPANY_ADMIN_MODERATOR]: "Company Admin / Moderator",
};

/** Which Menu.scope value gates the sidebar for a given layer - the same 2-value model buildEffectiveMenuTree() already uses, so SUPER_ADMIN/ADMIN share one menu set and COMPANY_ADMIN/MODERATOR share another. */
function scopeForLayer(layer: UserLayer): string | null {
  if (layer === USER_LAYERS.SUPER_ADMIN || layer === USER_LAYERS.ADMIN) return MENU_SCOPES.SUPER_ADMIN_ADMIN;
  if (layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR) return MENU_SCOPES.COMPANY_ADMIN_MODERATOR;
  return null; // CUSTOMER - only scope-less menus (e.g. its plain Dashboard link) ever apply
}

/**
 * Menu/Permission section - admin-side only (COMPANY_ADMIN/MODERATOR never
 * get this section; see management-view.tsx). Two parts: the existing Menu
 * CRUD table (relocated from /admin/menus, now pre-filtered to the menus
 * applicable to the selected layer) and a read-only rollup of what each of
 * this layer's roles grants (relocated from the old standalone
 * /admin/permissions overview) over the resources relevant to this layer.
 */
export function MenusSection({ layer, basePath, roles, resources }: { layer: UserLayer; basePath: string; roles: RoleRow[]; resources: { key: string; label: string }[] }) {
  const [allMenus, setAllMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      setAllMenus(await apiClient.get<MenuRow[]>("/api/menus"));
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

  const scope = scopeForLayer(layer);
  const rows = useMemo(() => allMenus.filter((m) => (m.scope ?? null) === scope), [allMenus, scope]);

  const columns: DataTableColumn<MenuRow>[] = [
    { key: "name", header: "Name", render: (r) => `${"—".repeat(Math.max(0, r.level - 1))} ${r.name}` },
    { key: "level", header: "Level", render: (r) => r.level },
    { key: "route", header: "Route", render: (r) => r.route ?? "—" },
    { key: "resourceKey", header: "Resource key", render: (r) => r.resourceKey ?? "—" },
    { key: "sortOrder", header: "Sort", render: (r) => r.sortOrder },
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
          <h2 className="text-base font-semibold text-ink">Menus &amp; permissions</h2>
          <p className="text-sm text-ink-soft">
            {scope
              ? `Menus visible to the ${SCOPE_LABELS[scope]} dashboard, and what each role above grants.`
              : "Menus visible to every authenticated user, regardless of role."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${basePath}/hierarchy`}>
            <Button size="sm" variant="secondary">
              <ListTree className="h-4 w-4" /> View hierarchy
            </Button>
          </Link>
          <PermissionGuard resource="menus" action="add">
            <Link href={`${basePath}/new?layer=${layer}`}>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add menu
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r._id}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={load}
        emptyTitle="No menu items yet"
        rowActions={(r) => (
          <RowActionsMenu label={`Actions for ${r.name}`}>
            <PermissionGuard resource="menus" action="edit">
              <RowActionLink href={`${basePath}/${r._id}/edit?layer=${layer}`} icon={<Pencil className="h-4 w-4" />} label="Edit" />
            </PermissionGuard>
            {r.isActive && (
              <PermissionGuard resource="menus" action="delete">
                <DeleteButton
                  itemLabel={r.name}
                  actionLabel="Deactivate"
                  onDelete={async () => {
                    await apiClient.delete(`/api/menus/${r._id}`);
                    await load();
                  }}
                  renderTrigger={(onClick) => (
                    <RowActionButton icon={<Trash2 className="h-4 w-4" />} label="Deactivate" variant="danger" onClick={onClick} />
                  )}
                />
              </PermissionGuard>
            )}
          </RowActionsMenu>
        )}
      />

      {roles.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm font-medium text-ink">What each role above grants (read-only)</p>
          {roles.map((role) => (
            <div key={role._id}>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {role.name} <span className="font-normal text-ink-soft">({role.slug})</span>
              </h3>
              <PermissionMatrix resources={resources} value={role.permissions} onChange={() => {}} disabled />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
