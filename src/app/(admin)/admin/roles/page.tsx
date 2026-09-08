"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { IconLink } from "@/components/ui/icon-link";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

type RoleRow = { _id: string; name: string; slug: string; isSystem: boolean; isActive: boolean };

export default function RolesPage() {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      setRows(await apiClient.get<RoleRow[]>("/api/roles"));
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

  const columns: DataTableColumn<RoleRow>[] = [
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
  ];

  return (
    <ContentContainer>
      <PageHeader
        title="Roles"
        description="Define roles and the permission matrix each one grants."
        actions={
          <PermissionGuard resource="roles" action="add">
            <Link href="/admin/roles/new">
              <Button><Plus className="h-4 w-4" /> Add role</Button>
            </Link>
          </PermissionGuard>
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
        emptyTitle="No roles yet"
        rowActions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <PermissionGuard resource="roles" action="edit">
              <IconLink href={`/admin/roles/${r._id}/edit`} label="Edit">
                <Pencil className="h-4 w-4" />
              </IconLink>
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
                />
              </PermissionGuard>
            )}
          </div>
        )}
      />
    </ContentContainer>
  );
}
