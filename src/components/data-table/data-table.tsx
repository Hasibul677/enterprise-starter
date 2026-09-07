"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ForbiddenState } from "@/components/feedback/forbidden";
import { Pagination } from "./pagination";
import type { PaginationMeta } from "@/lib/api/response";
import { cn } from "@/lib/utils/cn";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  /** When the API error code is "FORBIDDEN", renders <ForbiddenState/> instead of the generic error message. */
  errorCode?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  rowActions?: (row: T) => ReactNode;
};

/**
 * Generic reusable table. Feature tables (<UserTable/>, <RoleTable/>, and
 * every future module's table) configure columns/rowActions here instead of
 * re-implementing loading/empty/error/pagination behavior per page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  errorCode,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription,
  pagination,
  onPageChange,
  rowActions,
}: DataTableProps<T>) {
  if (error) return errorCode === "FORBIDDEN" ? <ForbiddenState /> : <ErrorState message={error} onRetry={onRetry} />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-soft">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5 font-medium", col.className)}>
                  {col.header}
                </th>
              ))}
              {rowActions && <th className="px-4 py-2.5 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line last:border-0 hover:bg-paper/60">
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-2.5 text-ink", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && <td className="px-4 py-2.5 text-right">{rowActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && onPageChange && <Pagination meta={pagination} onPageChange={onPageChange} />}
    </div>
  );
}
