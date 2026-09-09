"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Eye, Pencil, LogIn, Trash2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { RowActionLink, RowActionButton } from "@/components/data-table/row-action-item";
import { ImpersonateButton } from "@/components/users/impersonate-button";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { getImpersonationIneligibleReason } from "@/lib/permissions/role-hierarchy";
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
 * Shared user-list table used by both the SUPER_ADMIN/ADMIN Users page
 * (`/admin/users`, scoped server-side to admins-may-see) and the
 * COMPANY_ADMIN/MODERATOR Moderators page (`/company-admin/users`, scoped to
 * the actor's own moderators - see user.service.ts#buildUserListScopeFilter).
 * Both hit the SAME `/api/users` endpoint; the result set differs per actor,
 * never this component.
 */
export function UserListView({
  basePath,
  title,
  description,
  createLabel,
  emptyTitle,
  emptyDescription,
  userLayer,
  newHref,
}: {
  basePath: string;
  title: string;
  description: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Narrows the list to one fixed layer (the layer-tabbed management area's active tab). Server-revalidated - see user.service.ts#listUsers. */
  userLayer?: UserLayer;
  /** Href for the "Add" button and each row's link targets - defaults to `${basePath}/...` when omitted. */
  newHref?: string;
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

  // Carried on row links so the destination page (which only knows its own
  // route, not which management-area tab it was reached from) can build its
  // own "back to list" target pointing at the right layer tab.
  const layerQuery = userLayer ? `?layer=${userLayer}` : "";

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
        <PermissionGuard resource="users" action="add">
          <Link href={newHref ?? `${basePath}/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> {createLabel}
            </Button>
          </Link>
        </PermissionGuard>
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
              <RowActionLink href={`${basePath}/${r._id}${layerQuery}`} icon={<Eye className="h-4 w-4" />} label="View" />
            </PermissionGuard>
            <PermissionGuard resource="users" action="edit">
              <RowActionLink href={`${basePath}/${r._id}/edit${layerQuery}`} icon={<Pencil className="h-4 w-4" />} label="Edit" />
            </PermissionGuard>
            {/* Requirement #21, extended to Company Admin -> its own Moderators -
                Super Admin or Company Admin only, plus the same eligibility rules
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
            {r.status !== "DISABLED" && (
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
    </section>
  );
}
