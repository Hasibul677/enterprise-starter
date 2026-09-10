"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Eye, Pencil, ShieldCheck, KeyRound, ListTree, LogIn, Trash2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionButton } from "@/components/data-table/row-action-item";
import { ImpersonateButton } from "@/components/users/impersonate-button";
import { UserCreateDialog } from "@/components/users/user-create-dialog";
import { UserDetailDialog } from "@/components/users/user-detail-dialog";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { UserRoleDialog } from "@/components/users/user-role-dialog";
import { UserPermissionsDialog } from "@/components/users/user-permissions-dialog";
import { UserMenuAccessDialog } from "@/components/users/user-menu-access-dialog";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import {
  CREATABLE_LAYERS_BY,
  GRANTABLE_RESOURCES_BY,
  PERMISSION_GRANTERS,
  canManageLayer,
  getImpersonationIneligibleReason,
} from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";
import type { PaginationMeta } from "@/lib/api/response";
import { formatDate } from "@/lib/date/dayjs";

type UserRow = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  userLayer: UserLayer;
  managedBy: string | null;
  roles: { _id: string; name: string; slug: string }[];
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success-soft text-success",
  WARNING: "bg-warning-soft text-warning",
  BLOCKED: "bg-danger-soft text-danger",
  DISABLED: "bg-line text-ink-soft",
};

/**
 * Shared user-list table - the SOLE primary list on every layer tab of the
 * Management page (both `/admin/management` and `/company-admin/management`,
 * which hit the SAME `/api/users` endpoint - the result set differs per
 * actor, never this component - see user.service.ts#buildUserListScopeFilter).
 * Role and Menu management are no longer separate page sections - they live
 * behind this same row kebab (View/Edit/Role/Permissions/Menu Access/Login as
 * user/Deactivate), all opening in-page dialogs. There are no separate routes.
 */
export function UserListView({
  title,
  description,
  createLabel,
  emptyTitle,
  emptyDescription,
  userLayer,
}: {
  title: string;
  description: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Narrows the list to one fixed layer (the layer-tabbed management area's active tab). Server-revalidated - see user.service.ts#listUsers. */
  userLayer?: UserLayer;
}) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const currentUserLayer = useAuthStore((s) => s.userLayer);
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<UserRow | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [menuAccessTarget, setMenuAccessTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const { data, meta } = await apiClient.getPaginated<UserRow[]>("/api/users", {
        query: { page, limit: 20, search: search || undefined, userLayer },
      });
      setRows(data);
      setPagination(meta?.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, [page, search, userLayer]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination when the management area's active tab (layer) changes
    setPage(1);
  }, [userLayer]);

  const actorLayerForChecks = isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : currentUserLayer;

  // Gates the "Add" button per the SELECTED tab's layer, not just the
  // generic users.add permission - e.g. Super Admin still can't create
  // another Super Admin or a Moderator directly from here (see
  // role-hierarchy.ts CREATABLE_LAYERS_BY doc comment).
  const canCreateInLayer = useMemo(
    () => (userLayer ? (CREATABLE_LAYERS_BY[actorLayerForChecks] ?? []).includes(userLayer) : true),
    [actorLayerForChecks, userLayer]
  );

  // Whether the actor may EDIT/deactivate/reassign-role users of the
  // SELECTED tab's layer at all - a tab can be visible for VIEW only (e.g.
  // COMPANY_ADMIN's CUSTOMER tab, per VIEWABLE_TARGET_LAYERS_BY in
  // role-hierarchy.ts) without granting any write authority. Since the
  // whole tab is fixed to one layer, this is computed once rather than
  // per-row; every write-capable kebab item (Edit/Role/Menu access/
  // Deactivate) is additionally gated on it - "View" and the server-
  // independently-validated "Login as user"/"Permissions" items are not.
  const canManageThisLayer = useMemo(
    () => (userLayer ? canManageLayer(actorLayerForChecks, userLayer, isSuperAdmin) : true),
    [actorLayerForChecks, userLayer, isSuperAdmin]
  );

  // Resources this actor is allowed to grant as a per-user override - same
  // source of truth GRANTABLE_RESOURCES_BY already uses for server-side
  // enforcement (canGrantPermissionOverride()).
  const grantableResources = useMemo(
    () => (GRANTABLE_RESOURCES_BY[actorLayerForChecks] ?? []).map((key) => ({ key, label: key.replace(/_/g, " ") })),
    [actorLayerForChecks]
  );
  const permissionGranterTargetLayer = PERMISSION_GRANTERS[actorLayerForChecks];

  const columns: DataTableColumn<UserRow>[] = [
    { key: "name", header: "Name", render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "role", header: "Role", render: (r) => r.roles.map((role) => role.name).join(", ") || "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[r.status]}`}>{r.status}</span>
      ),
    },
    { key: "createdAt", header: "Joined", render: (r) => formatDate(r.createdAt, "MMM D, YYYY") },
  ];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="text-sm text-ink-soft">{description}</p>}
        </div>
        {canCreateInLayer && (
          <PermissionGuard resource="users" action="add">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {createLabel}
            </Button>
          </PermissionGuard>
        )}
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r._id}
        loading={loading}
        error={error}
        errorCode={errorCode}
        onRetry={load}
        pagination={pagination}
        onPageChange={setPage}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        rowActions={(r) => (
          <RowActionsMenu label={`Actions for ${r.firstName} ${r.lastName}`}>
            <PermissionGuard resource="users" action="view">
              <RowActionButton icon={<Eye className="h-4 w-4" />} label="View" onClick={() => setViewTarget(r)} />
            </PermissionGuard>
            {canManageThisLayer && (
              <>
                <PermissionGuard resource="users" action="edit">
                  <RowActionButton
                    icon={<Pencil className="h-4 w-4" />}
                    label="Edit"
                    onClick={() => setEditingUserId(r._id)}
                  />
                </PermissionGuard>
                <PermissionGuard resource="users" action="edit">
                  <RowActionButton
                    icon={<KeyRound className="h-4 w-4" />}
                    label="Role"
                    onClick={() => setRoleTarget(r)}
                  />
                </PermissionGuard>
              </>
            )}
            {permissionGranterTargetLayer === r.userLayer && (
              <PermissionGuard resource="permissions" action="edit">
                <RowActionButton
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Permissions"
                  onClick={() => setPermissionsUserId(r._id)}
                />
              </PermissionGuard>
            )}
            {canManageThisLayer && (
              <PermissionGuard resource="menus" action="view">
                <RowActionButton
                  icon={<ListTree className="h-4 w-4" />}
                  label="Menu access"
                  onClick={() => setMenuAccessTarget(r)}
                />
              </PermissionGuard>
            )}
            {/* Super Admin or Company Admin only, plus the same eligibility rules
                the server enforces (role-hierarchy.ts getImpersonationIneligibleReason -
                never for self, an unauthorized layer/ownership pairing, or a
                non-active account). This is UX filtering only: POST
                /api/auth/impersonate independently re-validates every one of
                these conditions server-side. */}
            {(isSuperAdmin || currentUserLayer === USER_LAYERS.COMPANY_ADMIN) &&
              currentUserId &&
              !getImpersonationIneligibleReason({
                actorUserId: currentUserId,
                actorLayer: currentUserLayer,
                isSuperAdmin,
                targetUserId: r._id,
                targetUserLayer: r.userLayer,
                targetStatus: r.status,
                targetManagedBy: r.managedBy,
              }) && (
                <ImpersonateButton
                  userId={r._id}
                  userLabel={`${r.firstName} ${r.lastName}`}
                  renderTrigger={(onClick) => (
                    <RowActionButton icon={<LogIn className="h-4 w-4" />} label="Login as user" onClick={onClick} />
                  )}
                />
              )}
            {canManageThisLayer && r.status !== "DISABLED" && (
              <PermissionGuard resource="users" action="delete">
                <DeleteButton
                  itemLabel={`${r.firstName} ${r.lastName}`}
                  actionLabel="Deactivate"
                  onDelete={async () => {
                    await apiClient.delete(`/api/users/${r._id}`);
                    await load();
                  }}
                  renderTrigger={(onClick) => (
                    <RowActionButton
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Deactivate"
                      variant="danger"
                      onClick={onClick}
                    />
                  )}
                />
              </PermissionGuard>
            )}
          </RowActionsMenu>
        )}
      />

      <UserCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          load();
        }}
        fixedUserLayer={userLayer === USER_LAYERS.MODERATOR ? USER_LAYERS.MODERATOR : undefined}
        initialLayer={userLayer}
      />
      <UserDetailDialog
        open={viewTarget !== null}
        onClose={() => setViewTarget(null)}
        userId={viewTarget?._id ?? null}
        canManage={canManageThisLayer}
        canGrantPermissions={viewTarget ? permissionGranterTargetLayer === viewTarget.userLayer : false}
        onEdit={() => {
          setEditingUserId(viewTarget?._id ?? null);
          setViewTarget(null);
        }}
        onManagePermissions={() => {
          setPermissionsUserId(viewTarget?._id ?? null);
          setViewTarget(null);
        }}
      />
      <UserEditDialog
        open={editingUserId !== null}
        onClose={() => setEditingUserId(null)}
        userId={editingUserId}
        allowRoleEdit={false}
        onSaved={() => {
          setEditingUserId(null);
          load();
        }}
      />
      <UserRoleDialog
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        userId={roleTarget?._id ?? null}
        userLayer={roleTarget?.userLayer ?? null}
        currentRoles={roleTarget?.roles ?? []}
        onSaved={() => {
          setRoleTarget(null);
          load();
        }}
      />
      <UserPermissionsDialog
        open={permissionsUserId !== null}
        onClose={() => setPermissionsUserId(null)}
        userId={permissionsUserId}
        resources={grantableResources}
        onSaved={() => setPermissionsUserId(null)}
      />
      <UserMenuAccessDialog
        open={menuAccessTarget !== null}
        onClose={() => setMenuAccessTarget(null)}
        userId={menuAccessTarget?._id ?? null}
        userLayer={menuAccessTarget?.userLayer ?? null}
      />
    </section>
  );
}
