"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionButton } from "@/components/data-table/row-action-item";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { MenuEditDialog, type MenuEditTarget } from "@/components/menus/menu-edit-dialog";
import { apiClient } from "@/lib/api-client/api-client";
import { MENU_SCOPES } from "@/lib/permissions/constants";

export type MenuRow = MenuEditTarget;

const SCOPE_LABELS: Record<string, string> = {
  [MENU_SCOPES.SUPER_ADMIN_ADMIN]: "Super Admin / Admin",
  [MENU_SCOPES.COMPANY_ADMIN_MODERATOR]: "Company Admin / Moderator",
};

/**
 * Presentational Menus table for a single layer tab - see
 * menu-management-view.tsx, which owns the fetch/tabs/"Add menu" toolbar and
 * passes down the rows already filtered to the active tab (same split as
 * role-list-view.tsx does for Roles).
 */
export function MenuListView({
  rows,
  loading,
  error,
  errorCode,
  onRetry,
  onChanged,
  menuByIdLabel,
}: {
  rows: MenuRow[];
  loading: boolean;
  error?: string;
  errorCode?: string;
  onRetry: () => void;
  onChanged: () => void;
  menuByIdLabel: (id: string | null) => string;
}) {
  const [dialogTarget, setDialogTarget] = useState<MenuEditTarget | null>(null);
  const [dialogReadOnly, setDialogReadOnly] = useState(false);

  function openDialog(menu: MenuRow, readOnly: boolean) {
    setDialogTarget(menu);
    setDialogReadOnly(readOnly);
  }

  const columns: DataTableColumn<MenuRow>[] = [
    { key: "label", header: "Label", render: (r) => r.label },
    { key: "key", header: "Key", render: (r) => r.key },
    { key: "route", header: "Route", render: (r) => r.route ?? "—" },
    { key: "parent", header: "Parent", render: (r) => menuByIdLabel(r.parentId) },
    { key: "resourceKey", header: "Resource key", render: (r) => r.resourceKey ?? "—" },
    { key: "scope", header: "Scope", render: (r) => (r.scope ? SCOPE_LABELS[r.scope] : "—") },
    {
      key: "isActive",
      header: "Active",
      render: (r) => <span className={r.isActive ? "text-success" : "text-ink-soft"}>{r.isActive ? "Yes" : "No"}</span>,
    },
    {
      key: "isVisible",
      header: "Visible",
      render: (r) => (
        <span className={r.isVisible ? "text-success" : "text-ink-soft"}>{r.isVisible ? "Yes" : "No"}</span>
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
        emptyTitle="No menu items found"
        emptyDescription="Create a menu item to get started."
        rowActions={(r) => (
          <RowActionsMenu label={`Actions for ${r.label}`}>
            <PermissionGuard resource="menus" action="view">
              <RowActionButton icon={<Eye className="h-4 w-4" />} label="View" onClick={() => openDialog(r, true)} />
            </PermissionGuard>
            <PermissionGuard resource="menus" action="edit">
              <RowActionButton
                icon={<Pencil className="h-4 w-4" />}
                label="Edit"
                onClick={() => openDialog(r, false)}
              />
            </PermissionGuard>
            <PermissionGuard resource="menus" action="delete">
              <DeleteButton
                itemLabel={r.label}
                onDelete={async () => {
                  await apiClient.delete(`/api/menus/${r._id}`);
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
          </RowActionsMenu>
        )}
      />
      <MenuEditDialog
        open={dialogTarget !== null}
        onClose={() => setDialogTarget(null)}
        onSaved={() => {
          setDialogTarget(null);
          onChanged();
        }}
        menu={dialogTarget}
        readOnly={dialogReadOnly}
      />
    </>
  );
}
