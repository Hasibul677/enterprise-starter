"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { DeleteButton } from "@/components/ui/delete-button";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import type { PaginationMeta } from "@/lib/api/response";
import { formatDate } from "@/lib/date/dayjs";

type UserRow = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success-soft text-success",
  WARNING: "bg-warning-soft text-warning",
  BLOCKED: "bg-danger-soft text-danger",
  DISABLED: "bg-line text-ink-soft",
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

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
        title="Users"
        description="Manage user accounts, roles, and status."
        actions={
          <PermissionGuard resource="users" action="add">
            <Link href="/admin/users/new">
              <Button>
                <Plus className="h-4 w-4" /> Add user
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
        emptyTitle="No users yet"
        emptyDescription="Create your first user to get started."
        rowActions={(r) => (
          <div className="flex items-center justify-end gap-3">
            <PermissionGuard resource="users" action="view">
              <Link href={`/users/${r._id}`} className="text-sm font-medium text-ink-soft hover:text-ink">
                View
              </Link>
            </PermissionGuard>
            <PermissionGuard resource="users" action="edit">
              <Link href={`/users/${r._id}/edit`} className="text-sm font-medium text-accent">
                Edit
              </Link>
            </PermissionGuard>
            {r.status !== "DISABLED" && (
              <PermissionGuard resource="users" action="delete">
                <DeleteButton
                  itemLabel={`${r.firstName} ${r.lastName}`}
                  onDelete={async () => {
                    await apiClient.delete(`/api/users/${r._id}`);
                    await load();
                  }}
                >
                  Deactivate
                </DeleteButton>
              </PermissionGuard>
            )}
          </div>
        )}
      />
    </ContentContainer>
  );
}
