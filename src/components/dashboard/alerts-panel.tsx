"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle, Info, Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/feedback/forbidden";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { AlertDetailsDialog } from "@/components/dashboard/alert-details-dialog";
import { formatRelativeTime } from "@/lib/dashboard/format";
import { formatDate } from "@/lib/date/dayjs";
import { cn } from "@/lib/utils/cn";
import type { SecurityAlert, AlertSeverity } from "@/services/dashboard.service";

export const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-accent-soft text-accent",
};

const SEVERITY_ICON: Record<AlertSeverity, typeof ShieldAlert> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

/**
 * "System alerts / suspicious activity" - self-contained, fetches
 * `/api/dashboard/alerts` (a real, RBAC-scoped read over AuditLogModel,
 * narrowed to a fixed set of security-relevant action types - see
 * dashboard.service.ts#getSecurityAlerts). Read-only: "View Details" opens
 * AlertDetailsDialog - there is no backend to persist a dismiss/resolve
 * action against, and every alert's `status` is truthfully "open" since no
 * review workflow is persisted anywhere.
 */
export function AlertsPanel() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [detailsTarget, setDetailsTarget] = useState<SecurityAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const data = await apiClient.get<SecurityAlert[]>("/api/dashboard/alerts");
      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security alerts.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  const columns: DataTableColumn<SecurityAlert>[] = [
    {
      key: "user",
      header: "User",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{a.user ? a.user.name : "System"}</p>
          {a.user && <p className="truncate text-xs text-ink-soft">{a.user.email}</p>}
        </div>
      ),
    },
    { key: "activity", header: "Activity", render: (a) => <span className="text-ink">{a.activity}</span> },
    {
      key: "timestamp",
      header: "Date/time",
      render: (a) => (
        <span className="whitespace-nowrap text-ink-soft" title={formatDate(a.timestamp, "MMM D, YYYY HH:mm [UTC]")}>
          {formatRelativeTime(a.timestamp)}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (a) => {
        const Icon = SEVERITY_ICON[a.severity];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              SEVERITY_STYLES[a.severity]
            )}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {a.severity}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium capitalize text-warning">
          {a.status}
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">System alerts</h3>
        </div>
        {!loading && !error && alerts.length > 0 && (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
            {alerts.length} open
          </span>
        )}
      </div>
      {errorCode === "FORBIDDEN" ? (
        <ForbiddenState />
      ) : (
        <DataTable
          columns={columns}
          rows={alerts}
          rowKey={(a) => a.id}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No alerts"
          emptyDescription="Suspicious or unusual account activity will show up here."
          rowActions={(a) => (
            <Button size="sm" variant="secondary" onClick={() => setDetailsTarget(a)}>
              <Eye className="h-3.5 w-3.5" /> View details
            </Button>
          )}
        />
      )}
      <AlertDetailsDialog alert={detailsTarget} onClose={() => setDetailsTarget(null)} />
    </div>
  );
}
