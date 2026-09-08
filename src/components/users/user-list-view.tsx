"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Eye, Pencil } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { IconLink } from "@/components/ui/icon-link";
import { ImpersonateButton } from "@/components/users/impersonate-button";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { getImpersonationIneligibleReason } from "@/lib/permissions/role-hierarchy";
import type { RoleSlug } from "@/lib/permissions/constants";
import type { PaginationMeta } from "@/lib/api/response";
import { formatDate } from "@/lib/date/dayjs";

type UserRow = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
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
 * NORMAL_ADMIN/MODERATOR Moderators page (`/normal-admin/users`, scoped to
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
}: {
  basePath: string;
  title: string;
  description: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const currentUserId = useAuthStore((s) => s.user?._id);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const { data, meta } = await apiClient.getPaginated<UserRow[]>("/api/users", {
        query: { page, limit: 20, search: search || undefined },
      });
      setRows(data);
      setPagination(meta?.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

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
    <ContentContainer>
      <PageHeader
        title={title}
        description={description}
        actions={
          <PermissionGuard resource="users" action="add">
            <Link href={`${basePath}/new`}>
              <Button>
                <Plus className="h-4 w-4" /> {createLabel}
              </Button>
            </Link>
          </PermissionGuard>
        }
      />
      <div className="mb-4 max-w-xs">
        <SearchInput placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
          <div className="flex items-center justify-end gap-1">
            <PermissionGuard resource="users" action="view">
              <IconLink href={`${basePath}/${r._id}`} label="View">
                <Eye className="h-4 w-4" />
              </IconLink>
            </PermissionGuard>
            <PermissionGuard resource="users" action="edit">
              <IconLink href={`${basePath}/${r._id}/edit`} label="Edit">
                <Pencil className="h-4 w-4" />
              </IconLink>
            </PermissionGuard>
            {/* Requirement #21 - Super Admin only, plus the same eligibility rules
                the server enforces (role-hierarchy.ts getImpersonationIneligibleReason -
                never for self, another Super Admin, or a non-active account). This is
                UX filtering only: POST /api/auth/impersonate independently re-validates
                every one of these conditions server-side. */}
            {isSuperAdmin &&
              currentUserId &&
              !getImpersonationIneligibleReason({
                actorUserId: currentUserId,
                targetUserId: r._id,
                targetSlugs: r.roles.map((role) => role.slug as RoleSlug),
                targetStatus: r.status,
              }) && <ImpersonateButton userId={r._id} userLabel={`${r.firstName} ${r.lastName}`} />}
            {r.status !== "DISABLED" && (
              <PermissionGuard resource="users" action="delete">
                <DeleteButton
                  itemLabel={`${r.firstName} ${r.lastName}`}
                  actionLabel="Deactivate"
                  onDelete={async () => {
                    await apiClient.delete(`/api/users/${r._id}`);
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
