"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Loading } from "@/components/feedback/loading";
import { Alert } from "@/components/feedback/alert";
import { Button } from "@/components/ui/button";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { mergeRolePermissions } from "@/lib/permissions/merge";
import type { PermissionMap } from "@/lib/permissions/constants";

type PermissionsResponse = { rolePermissions: PermissionMap; overrides: PermissionMap };

/**
 * Shared per-user permission-override editor (requirement #9) - Super Admin
 * assigning extra permissions to one ADMIN, or a Normal Admin assigning
 * extra permissions to one of its own MODERATORs. Both read/write the same
 * `/api/users/[id]/permissions` endpoint; `resources` limits which columns
 * this particular dashboard is even allowed to touch (server re-validates
 * regardless - see role-hierarchy.ts canGrantPermissionOverride()).
 */
export function UserPermissionsView({
  basePath,
  resources,
}: {
  basePath: string;
  resources: { key: string; label: string }[];
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rolePermissions, setRolePermissions] = useState<PermissionMap>({});
  const [overrides, setOverrides] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiClient
      .get<PermissionsResponse>(`/api/users/${id}/permissions`)
      .then(({ rolePermissions, overrides }) => {
        setRolePermissions(rolePermissions);
        setOverrides(overrides);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load permissions."))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await apiClient.patch(`/api/users/${id}/permissions`, { permissions: overrides });
      router.push(`${basePath}/${id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ContentContainer><Loading /></ContentContainer>;

  // What this user would effectively have if the override were applied -
  // purely illustrative (the role-derived baseline can't be revoked here).
  const effective = mergeRolePermissions([
    { isActive: true, permissions: rolePermissions },
    { isActive: true, permissions: overrides },
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="Permissions"
        description="Grant this user extra access on top of their role's baseline permissions."
        backHref={`${basePath}/${id}`}
      />
      {error && <div className="mb-4"><Alert variant="danger">{error}</Alert></div>}
      <p className="mb-2 text-sm text-ink-soft">
        Toggling a cell grants (or revokes) an override for this user specifically - it never changes the shared role
        definition, so no one else with the same role is affected.
      </p>
      <PermissionMatrix resources={resources} value={overrides} onChange={setOverrides} />
      <p className="mt-3 text-xs text-ink-soft">
        Effective access (role + overrides): {Object.entries(effective).filter(([, v]) => Object.values(v).some(Boolean)).length} resource(s) granted.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save permissions"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push(`${basePath}/${id}`)}>Cancel</Button>
      </div>
    </ContentContainer>
  );
}
