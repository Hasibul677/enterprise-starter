"use client";

import { useEffect, useState, useCallback } from "react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { apiClient } from "@/lib/api-client/api-client";
import { CORE_RESOURCES, type PermissionMap } from "@/lib/permissions/constants";

type RoleRow = { _id: string; name: string; slug: string; permissions: PermissionMap };

const RESOURCES = Object.values(CORE_RESOURCES).map((key) => ({ key, label: key.replace(/_/g, " ") }));

/**
 * Read-only role x permission overview (requirement #17 "role/permission
 * overview"). Assigning a role's baseline permissions still happens on the
 * Roles page (Super Admin only); per-user overrides live on each user's own
 * Permissions page - see user-permissions-view.tsx.
 */
export default function PermissionOverviewPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRoles(await apiClient.get<RoleRow[]>("/api/roles"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  return (
    <ContentContainer>
      <PageHeader title="Permission Management" description="Read-only overview of what each role grants." />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {roles.map((role) => (
            <div key={role._id}>
              <h2 className="mb-2 text-sm font-semibold text-ink">
                {role.name} <span className="font-normal text-ink-soft">({role.slug})</span>
              </h2>
              <PermissionMatrix resources={RESOURCES} value={role.permissions} onChange={() => {}} disabled />
            </div>
          ))}
        </div>
      )}
    </ContentContainer>
  );
}
