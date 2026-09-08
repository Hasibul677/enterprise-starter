"use client";

import { useEffect, useState, useCallback } from "react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { apiClient } from "@/lib/api-client/api-client";

/**
 * Minimal, genuinely-server-enforced placeholder page: fetches `endpoint`
 * (itself gated by requirePermission()) and shows either the payload or the
 * 403 the server actually returned. Used for the resource stubs
 * (Comments/Reports/Settings) that prove the permission+menu+route pipeline
 * end-to-end without pretending to implement real business logic.
 */
export function ResourceStubView({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint: string;
}) {
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await apiClient.get<{ message?: string; items?: unknown[] }>(endpoint);
      setMessage(data.message ?? `${data.items?.length ?? 0} item(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  return (
    <ContentContainer>
      <PageHeader title={title} description={description} />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-soft">{message}</div>
      )}
    </ContentContainer>
  );
}
