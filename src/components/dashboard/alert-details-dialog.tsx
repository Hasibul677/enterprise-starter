"use client";

import { Dialog } from "@/components/modal/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date/dayjs";
import { SEVERITY_STYLES } from "@/components/dashboard/alerts-panel";
import type { SecurityAlert } from "@/services/dashboard.service";
import { cn } from "@/lib/utils/cn";

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Read-only detail view for the "View Details" alert action - there is no
 * backend to persist a dismiss/resolve action against, so this never offers
 * one. Every field shown here comes straight from the real AuditLog entry
 * (entityType/entityId/metadata) - no invented description text.
 */
export function AlertDetailsDialog({ alert, onClose }: { alert: SecurityAlert | null; onClose: () => void }) {
  const metadataEntries = alert ? Object.entries(alert.metadata) : [];

  return (
    <Dialog
      open={alert !== null}
      onClose={onClose}
      title={alert?.activity ?? ""}
      description={alert ? formatDate(alert.timestamp, "MMM D, YYYY [at] HH:mm [UTC]") : undefined}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {alert && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex gap-2">
            <span
              className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", SEVERITY_STYLES[alert.severity])}
            >
              {alert.severity}
            </span>
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium capitalize text-warning">
              {alert.status}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">User</p>
            {alert.user ? (
              <>
                <p className="text-ink">{alert.user.name}</p>
                <p className="text-ink-soft">{alert.user.email}</p>
              </>
            ) : (
              <p className="text-ink-soft">System</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Entity</p>
            <p className="text-ink">
              {alert.entityType}
              {alert.entityId && <span className="text-ink-soft"> &middot; {alert.entityId}</span>}
            </p>
          </div>
          {metadataEntries.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Details</p>
              <dl className="flex flex-col gap-1 rounded-md border border-line bg-paper p-2.5">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="shrink-0 text-ink-soft">{key}</dt>
                    <dd className="truncate text-right text-ink">{formatMetadataValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
