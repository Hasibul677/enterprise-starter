"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/modal/dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { canManageRole } from "@/lib/permissions/role-hierarchy";
import { resourceOptionsForLayer } from "@/lib/permissions/layer-mappings";
import { type UserLayer, type PermissionMap } from "@/lib/permissions/constants";

type RoleOption = { _id: string; name: string };
type RoleDetail = {
  _id: string;
  name: string;
  userLayer: UserLayer;
  isSystem: boolean;
  isActive: boolean;
  managedBy: string | null;
  permissions: PermissionMap;
};

/**
 * Per-user "Role" modal: assign which role(s) this user holds
 * (PATCH /api/users/:id, same as the old Edit form's role picker), and edit
 * the permission matrix of whichever assigned role is selected below
 * (PATCH /api/roles/:id) - replacing the old standalone Roles table.
 * Editing a role's permissions here still changes it for every OTHER user
 * who also holds that role (roles are shared, dynamic bundles, never
 * per-user) - same server-side behavior as the old Edit Role page, just
 * reached from a different place. canManageRole() decides whether the
 * matrix is editable at all for the currently-selected role (e.g. a
 * Company Admin can assign the shared system default role to its
 * moderators but never edit it - Super Admin owns it).
 */
export function UserRoleDialog({
  open,
  onClose,
  onSaved,
  userId,
  userLayer,
  currentRoles,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
  userLayer: UserLayer | null;
  currentRoles: { _id: string; name: string }[];
}) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const actorLayer = useAuthStore((s) => s.userLayer);
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [options, setOptions] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleDetail, setRoleDetail] = useState<RoleDetail | null>(null);
  const [matrixValue, setMatrixValue] = useState<PermissionMap>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userLayer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets/fetches each time the dialog opens for a new userId, not a render-time state sync
    setLoadingOptions(true);
    setGlobalError(null);
    const initialIds = currentRoles.map((r) => r._id);
    setSelectedRoleIds(initialIds);
    setEditingRoleId(initialIds[0] ?? null);
    apiClient
      .get<RoleOption[]>("/api/roles/assignable", { query: { layer: userLayer } })
      .then((roles) => {
        const merged = new Map(roles.map((r) => [r._id, r] as const));
        for (const r of currentRoles) if (!merged.has(r._id)) merged.set(r._id, r);
        setOptions(Array.from(merged.values()));
      })
      .catch(() => setOptions(currentRoles))
      .finally(() => setLoadingOptions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  useEffect(() => {
    if (!open || !editingRoleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale role detail when the selection is cleared, not a render-time state sync
      setRoleDetail(null);
      return;
    }
    setLoadingRole(true);
    apiClient
      .get<{ role: RoleDetail }>(`/api/roles/${editingRoleId}`)
      .then(({ role }) => {
        setRoleDetail(role);
        setMatrixValue(role.permissions);
      })
      .catch(() => setRoleDetail(null))
      .finally(() => setLoadingRole(false));
  }, [open, editingRoleId]);

  function onSelectRoles(ids: string[]) {
    setSelectedRoleIds(ids);
    if (editingRoleId && !ids.includes(editingRoleId)) setEditingRoleId(ids[0] ?? null);
    else if (!editingRoleId && ids.length > 0) setEditingRoleId(ids[0]);
  }

  const canEditRolePermissions =
    !!roleDetail &&
    !!currentUserId &&
    canManageRole({ isSuperAdmin, actorUserId: currentUserId, actorLayer, role: roleDetail });

  async function save() {
    if (!userId) return;
    setSaving(true);
    setGlobalError(null);
    try {
      await apiClient.patch(`/api/users/${userId}`, { roleIds: selectedRoleIds });
      if (roleDetail && canEditRolePermissions) {
        await apiClient.patch(`/api/roles/${roleDetail._id}`, { permissions: matrixValue });
      }
      onSaved();
    } catch (err) {
      setGlobalError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const resources = userLayer ? resourceOptionsForLayer(userLayer) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Role"
      description="Assign a role, and edit what it grants if you manage it."
      preventClose={saving}
      className="max-w-[80vw]"
    >
      {loadingOptions ? (
        <Loading />
      ) : (
        <>
          {globalError && (
            <div className="mb-4">
              <Alert variant="danger">{globalError}</Alert>
            </div>
          )}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-ink">Assigned role(s)</label>
            <MultiSelect
              options={options.map((o) => ({ value: o._id, label: o.name }))}
              value={selectedRoleIds}
              onChange={onSelectRoles}
            />
          </div>
          {selectedRoleIds.length > 1 && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-ink">Editing permissions for</label>
              <Select
                value={editingRoleId ?? ""}
                onChange={(e) => setEditingRoleId(e.target.value)}
                placeholder="Select a role"
                options={selectedRoleIds.map((id) => ({
                  value: id,
                  label: options.find((o) => o._id === id)?.name ?? id,
                }))}
              />
            </div>
          )}
          <PermissionGuard resource="roles" action="view">
            {loadingRole ? (
              <Loading />
            ) : roleDetail ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">
                  Permissions for {roleDetail.name}
                  {!canEditRolePermissions && (
                    <span className="ml-2 font-normal text-ink-soft">
                      (read-only - you don&apos;t manage this role)
                    </span>
                  )}
                </p>
                <PermissionMatrix
                  resources={resources}
                  value={matrixValue}
                  onChange={setMatrixValue}
                  disabled={!canEditRolePermissions}
                />
              </div>
            ) : (
              selectedRoleIds.length === 0 && <p className="text-sm text-ink-soft">No role assigned.</p>
            )}
          </PermissionGuard>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
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
