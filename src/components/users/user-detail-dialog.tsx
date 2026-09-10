"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/modal/dialog";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { apiClient } from "@/lib/api-client/api-client";
import { formatDate } from "@/lib/date/dayjs";

type UserDetail = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { _id: string; name: string }[];
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success-soft text-success",
  WARNING: "bg-warning-soft text-warning",
  BLOCKED: "bg-danger-soft text-danger",
  DISABLED: "bg-line text-ink-soft",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Modal version of the former `/.../users/[id]` detail pages. "Edit" and
 * "Permissions" hand back to the parent (UserListView) instead of navigating -
 * the parent owns which dialog is currently open and swaps this one out for
 * UserEditDialog/UserPermissionsDialog.
 *
 * `canManage`/`canGrantPermissions` mirror the same per-layer gating the
 * kebab menu applies (canManageLayer() / PERMISSION_GRANTERS in
 * role-hierarchy.ts) - View is reachable for a broader, view-only set of
 * layers (e.g. a COMPANY_ADMIN viewing its CUSTOMER accounts), so this
 * dialog's own Edit/Permissions buttons must independently re-check that
 * narrower authority rather than relying on the generic PermissionGuard
 * (actor-only, layer-unaware) alone.
 */
export function UserDetailDialog({
  open,
  onClose,
  userId,
  canManage,
  canGrantPermissions,
  onEdit,
  onManagePermissions,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  canManage: boolean;
  canGrantPermissions: boolean;
  onEdit: () => void;
  onManagePermissions: () => void;
}) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the user each time the dialog opens for a new userId, not a render-time state sync
    setLoading(true);
    setError(undefined);
    apiClient
      .get<{ user: UserDetail }>(`/api/users/${userId}`)
      .then(({ user }) => setUser(user))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load user."))
      .finally(() => setLoading(false));
  }, [open, userId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user ? `${user.firstName} ${user.lastName}` : "User details"}
      description={user?.email}
      className="max-w-lg"
    >
      {loading && <Loading />}
      {!loading && (error || !user) && <ErrorState message={error ?? "User not found."} />}
      {!loading && user && (
        <>
          <div className="rounded-lg border border-line bg-paper p-4">
            <Row
              label="Status"
              value={
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[user.status]}`}>
                  {user.status}
                </span>
              }
            />
            <Row label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
            <Row label="Roles" value={user.roles.map((r) => r.name).join(", ") || "None"} />
            <Row
              label="Last login"
              value={user.lastLoginAt ? formatDate(user.lastLoginAt, "MMM D, YYYY HH:mm") : "Never"}
            />
            <Row label="Joined" value={formatDate(user.createdAt, "MMM D, YYYY")} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {canGrantPermissions && (
              <PermissionGuard resource="permissions" action="edit">
                <Button variant="secondary" onClick={onManagePermissions}>
                  Permissions
                </Button>
              </PermissionGuard>
            )}
            {canManage && (
              <PermissionGuard resource="users" action="edit">
                <Button variant="secondary" onClick={onEdit}>
                  Edit
                </Button>
              </PermissionGuard>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
