"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { Skeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ForbiddenState } from "@/components/feedback/forbidden";
import { formatDate } from "@/lib/date/dayjs";
import { cn } from "@/lib/utils/cn";

type RecentUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  userLayer: string;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-success-soft text-success",
  WARNING: "bg-warning-soft text-warning",
  BLOCKED: "bg-danger-soft text-danger",
  DISABLED: "bg-line text-ink-soft",
};

const LAYER_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  COMPANY_ADMIN: "Company Admin",
  MODERATOR: "Moderator",
  CUSTOMER: "Customer",
};

/**
 * Self-contained: fetches its own slice of the existing, already-scoped
 * `GET /api/users` (sorted `createdAt: -1` server-side already - see
 * user.repository.ts#list) rather than depending on the stats endpoint, so a
 * slow/broken stats call never blanks this widget or vice versa.
 */
export function RecentUsersCard() {
  const [rows, setRows] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const { data } = await apiClient.getPaginated<RecentUser[]>("/api/users", { query: { page: 1, limit: 6 } });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recent users.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-ink-soft" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Recent users</h3>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        errorCode === "FORBIDDEN" ? (
          <ForbiddenState />
        ) : (
          <ErrorState message={error} onRetry={load} />
        )
      ) : rows.length === 0 ? (
        <EmptyState title="No users yet" description="Newly created accounts will show up here." />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((u) => (
            <li key={u._id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-xs text-ink-soft">{u.email}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[u.status])}>
                  {u.status}
                </span>
                <span className="text-xs text-ink-soft">{LAYER_LABELS[u.userLayer] ?? u.userLayer}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && rows.length > 0 && (
        <p className="mt-3 text-xs text-ink-soft">Newest joined {formatDate(rows[0].createdAt, "MMM D, YYYY")}</p>
      )}
    </div>
  );
}
