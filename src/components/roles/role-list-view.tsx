"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionButton } from "@/components/data-table/row-action-item";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { RoleEditDialog, type RoleEditTarget } from "@/components/roles/role-edit-dialog";
import { apiClient } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { canManageRole } from "@/lib/permissions/role-hierarchy";

export type RoleRow = RoleEditTarget & { slug: string; managedBy: string | null };

/**
 * Presentational Roles table for a single layer tab (see
 * role-management-view.tsx, which owns the fetch/tabs/"Add role" toolbar and
 * passes down the rows already filtered to the active tab). Mirrors the
 * DataTable + RowActionsMenu pattern user-list-view.tsx already uses for
 * Users, so View/Edit/Delete behave identically here.
 */
export function RoleListView({
  rows,
  loading,
  error,
  errorCode,
  onRetry,
  onChanged,
  emptyTitle,
  emptyDescription,
}: {
  rows: RoleRow[];
  loading: boolean;
  error?: string;
  errorCode?: string;
  onRetry: () => void;
  onChanged: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const actorLayer = useAuthStore((s) => s.userLayer);
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [dialogTarget, setDialogTarget] = useState<RoleEditTarget | null>(null);
  const [dialogReadOnly, setDialogReadOnly] = useState(false);

  function openDialog(role: RoleRow, readOnly: boolean) {
    setDialogTarget(role);
    setDialogReadOnly(readOnly);
  }

  const columns: DataTableColumn<RoleRow>[] = [
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "slug", header: "Slug", render: (r) => r.slug },
    { key: "userLayer", header: "Layer", render: (r) => r.userLayer },
    { key: "system", header: "System", render: (r) => (r.isSystem ? "Yes" : "No") },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={r.isActive ? "text-success" : "text-ink-soft"}>{r.isActive ? "Active" : "Inactive"}</span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r._id}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        rowActions={(r) => {
          const canManage = currentUserId
            ? canManageRole({ isSuperAdmin, actorUserId: currentUserId, actorLayer, role: r })
            : false;
          return (
            <RowActionsMenu label={`Actions for ${r.name}`}>
              <PermissionGuard resource="roles" action="view">
                <RowActionButton icon={<Eye className="h-4 w-4" />} label="View" onClick={() => openDialog(r, true)} />
              </PermissionGuard>
              {canManage && (
                <PermissionGuard resource="roles" action="edit">
                  <RowActionButton
                    icon={<Pencil className="h-4 w-4" />}
                    label="Edit"
                    onClick={() => openDialog(r, false)}
                  />
                </PermissionGuard>
              )}
              {canManage && !r.isSystem && (
                <PermissionGuard resource="roles" action="delete">
                  <DeleteButton
                    itemLabel={r.name}
                    onDelete={async () => {
                      await apiClient.delete(`/api/roles/${r._id}`);
                      onChanged();
                    }}
                    renderTrigger={(onClick) => (
                      <RowActionButton
                        icon={<Trash2 className="h-4 w-4" />}
                        label="Delete"
                        variant="danger"
                        onClick={onClick}
                      />
                    )}
                  />
                </PermissionGuard>
              )}
            </RowActionsMenu>
          );
        }}
      />
      <RoleEditDialog
        open={dialogTarget !== null}
        onClose={() => setDialogTarget(null)}
        onSaved={() => {
          setDialogTarget(null);
          onChanged();
        }}
        role={dialogTarget}
        readOnly={dialogReadOnly}
      />
    </>
  );
}
