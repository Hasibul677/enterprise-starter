"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, GitBranch, Pencil } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { IconLink } from "@/components/ui/icon-link";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { MENU_SCOPES } from "@/lib/permissions/constants";

type MenuRow = {
  _id: string;
  name: string;
  level: number;
  route?: string | null;
  sortOrder: number;
  isActive: boolean;
  scope?: string | null;
};

const SCOPE_LABELS: Record<string, string> = {
  [MENU_SCOPES.SUPER_ADMIN_ADMIN]: "Super Admin / Admin",
  [MENU_SCOPES.NORMAL_ADMIN_MODERATOR]: "Normal Admin / Moderator",
};

export default function MenusPage() {
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      setRows(await apiClient.get<MenuRow[]>("/api/menus"));
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

  const columns: DataTableColumn<MenuRow>[] = [
    { key: "name", header: "Name", render: (r) => "—".repeat(r.level - 1) + " " + r.name },
    { key: "level", header: "Level", render: (r) => r.level },
    { key: "route", header: "Route", render: (r) => r.route ?? "—" },
    {
      key: "scope",
      header: "Scope",
      render: (r) =>
        r.scope ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{SCOPE_LABELS[r.scope] ?? r.scope}</span>
        ) : (
          <span className="text-xs text-ink-soft">—</span>
        ),
    },
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
    <ContentContainer>
      <PageHeader
        title="Menus"
        description="Manage the 3-level navigation hierarchy shown in the sidebar."
        actions={
          <>
            <Link href="/admin/menus/hierarchy">
              <Button variant="secondary">
                <GitBranch className="h-4 w-4" /> View hierarchy
              </Button>
            </Link>
            <PermissionGuard resource="menus" action="add">
              <Link href="/admin/menus/new">
                <Button><Plus className="h-4 w-4" /> Add menu</Button>
              </Link>
            </PermissionGuard>
          </>
        }
      />
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
          <div className="flex items-center justify-end gap-1">
            <PermissionGuard resource="menus" action="edit">
              <IconLink href={`/admin/menus/${r._id}/edit`} label="Edit">
                <Pencil className="h-4 w-4" />
              </IconLink>
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
                />
              </PermissionGuard>
            )}
          </div>
        )}
      />
    </ContentContainer>
  );
}
