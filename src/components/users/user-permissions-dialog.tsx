"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/modal/dialog";
import { Loading } from "@/components/feedback/loading";
import { Alert } from "@/components/feedback/alert";
import { Button } from "@/components/ui/button";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { mergeRolePermissions } from "@/lib/permissions/merge";
import type { PermissionMap } from "@/lib/permissions/constants";

type PermissionsResponse = { rolePermissions: PermissionMap; overrides: PermissionMap };

/**
 * Shared per-user permission-override editor - Super Admin assigning extra
 * permissions to one ADMIN, or a Normal Admin assigning extra permissions to
 * one of its own MODERATORs. Both read/write the same
 * `/api/users/[id]/permissions` endpoint; `resources` limits which columns
 * this particular dashboard is even allowed to touch (server re-validates
 * regardless - see role-hierarchy.ts canGrantPermissionOverride()).
 */
export function UserPermissionsDialog({
  open,
  onClose,
  onSaved,
  userId,
  resources,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
  resources: { key: string; label: string }[];
}) {
  const [rolePermissions, setRolePermissions] = useState<PermissionMap>({});
  const [overrides, setOverrides] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches permissions each time the dialog opens for a new userId, not a render-time state sync
    setLoading(true);
    setError(undefined);
    apiClient
      .get<PermissionsResponse>(`/api/users/${userId}/permissions`)
      .then(({ rolePermissions, overrides }) => {
        setRolePermissions(rolePermissions);
        setOverrides(overrides);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load permissions."))
      .finally(() => setLoading(false));
  }, [open, userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(undefined);
    try {
      await apiClient.patch(`/api/users/${userId}/permissions`, { permissions: overrides });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  }

  // What this user would effectively have if the override were applied -
  // purely illustrative (the role-derived baseline can't be revoked here).
  const effective = mergeRolePermissions([
    { isActive: true, permissions: rolePermissions },
    { isActive: true, permissions: overrides },
  ]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Permissions"
      description="Grant this user extra access on top of their role's baseline permissions."
      preventClose={saving}
      className="max-w-[80vw]"
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          {error && (
            <div className="mb-4">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}
          <p className="mb-2 text-sm text-ink-soft">
            Cells with a lock icon are already granted by the user&apos;s current role and can&apos;t be revoked here.
            Toggling any other cell grants (or revokes) an override for this user specifically - it never changes the
            shared role definition, so no one else with the same role is affected.
          </p>
          <PermissionMatrix
            resources={resources}
            value={overrides}
            onChange={setOverrides}
            lockedValue={rolePermissions}
          />
          <p className="mt-3 text-xs text-ink-soft">
            Effective access (role + overrides):{" "}
            {Object.entries(effective).filter(([, v]) => Object.values(v).some(Boolean)).length} resource(s) granted.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save permissions"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
