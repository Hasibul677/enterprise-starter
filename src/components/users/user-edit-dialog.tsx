"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userUpdateSchema, type UserUpdateInput } from "@/features/users/schemas/user-update.schema";
import { Dialog } from "@/components/modal/dialog";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { PermissionGuard } from "@/components/permission/permission-guard";
import type { UserLayer } from "@/lib/permissions/constants";

type RoleOption = { _id: string; name: string };
type UserDetail = {
  _id: string;
  firstName: string;
  lastName: string;
  status: string;
  userLayer: UserLayer;
  roles: { _id: string; name: string }[];
};

/**
 * Shared "edit user" modal. `allowRoleEdit` is currently always on (both
 * areas let the actor reassign the target's role, never their layer - the
 * server independently rejects any change it doesn't authorize either way,
 * see user.service.ts#updateUser); the flag exists so a future caller can
 * turn it off without touching this component.
 *
 * Role options come from GET /api/roles/assignable?layer=<the user's own,
 * fixed layer>, not GET /api/roles (the latter needs a `roles.view` grant an
 * Admin may not have). The target's CURRENT role(s) are merged in even if
 * not "assignable" (e.g. a custom role owned by a different Company Admin),
 * purely so the picker shows a real label instead of a blank entry;
 * submitting with that role UNCHANGED is still accepted server-side.
 */
export function UserEditDialog({
  open,
  onClose,
  onSaved,
  userId,
  allowRoleEdit,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
  allowRoleEdit: boolean;
}) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<UserUpdateInput>({ resolver: zodResolver(userUpdateSchema) });

  useEffect(() => {
    if (!open || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the user each time the dialog opens for a new userId, not a render-time state sync
    setLoading(true);
    setGlobalError(null);
    apiClient
      .get<{ user: UserDetail }>(`/api/users/${userId}`)
      .then(async ({ user }) => {
        const roleList = allowRoleEdit
          ? await apiClient
              .get<RoleOption[]>("/api/roles/assignable", { query: { layer: user.userLayer } })
              .catch(() => [])
          : [];
        const merged = new Map(roleList.map((r) => [r._id, r] as const));
        for (const r of user.roles) {
          if (!merged.has(r._id)) merged.set(r._id, { _id: r._id, name: r.name });
        }
        setRoles(Array.from(merged.values()));
        form.reset({
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status as UserUpdateInput["status"],
          roleIds: user.roles.map((r) => r._id),
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  async function onSubmit(values: UserUpdateInput) {
    if (!userId) return;
    setGlobalError(null);
    try {
      const payload = allowRoleEdit
        ? values
        : { firstName: values.firstName, lastName: values.lastName, status: values.status };
      await apiClient.patch(`/api/users/${userId}`, payload);
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError) {
        applyServerErrors(form.setError, err.errors);
        setGlobalError(err.errors?.length ? null : err.message);
      } else {
        setGlobalError("Something went wrong.");
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit user"
      description="Update profile, roles, and account status."
      preventClose={form.formState.isSubmitting}
      className="max-w-xl"
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          {globalError && (
            <div className="mb-4">
              <Alert variant="danger">{globalError}</Alert>
            </div>
          )}
          <Form form={form} onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField<UserUpdateInput>
                name="firstName"
                label="First name"
                render={(f) => (
                  <Input
                    id={f.id}
                    placeholder="e.g. Jane"
                    value={f.value as string}
                    onChange={(e) => f.onChange(e.target.value)}
                    onBlur={f.onBlur}
                    invalid={f.invalid}
                  />
                )}
              />
              <FormField<UserUpdateInput>
                name="lastName"
                label="Last name"
                render={(f) => (
                  <Input
                    id={f.id}
                    placeholder="e.g. Doe"
                    value={f.value as string}
                    onChange={(e) => f.onChange(e.target.value)}
                    onBlur={f.onBlur}
                    invalid={f.invalid}
                  />
                )}
              />
              <PermissionGuard resource="users" action="edit">
                <FormField<UserUpdateInput>
                  name="status"
                  label="Account status"
                  render={(f) => (
                    <Select
                      id={f.id}
                      value={f.value as string}
                      onChange={(e) => f.onChange(e.target.value)}
                      placeholder="Select a status"
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "WARNING", label: "Warning" },
                        { value: "BLOCKED", label: "Blocked" },
                        { value: "DISABLED", label: "Disabled" },
                      ]}
                    />
                  )}
                />
              </PermissionGuard>
            </div>
            {allowRoleEdit && (
              <FormField<UserUpdateInput>
                name="roleIds"
                label="Roles"
                render={(f) => (
                  <MultiSelect
                    options={roles.map((r) => ({ value: r._id, label: r.name }))}
                    value={(f.value as string[]) ?? []}
                    onChange={f.onChange}
                  />
                )}
              />
            )}
            <div className="flex gap-2">
              <SubmitButton loading={form.formState.isSubmitting}>Save changes</SubmitButton>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </Form>
        </>
      )}
    </Dialog>
  );
}
