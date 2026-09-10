"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleUpdateSchema, type RoleUpdateInput } from "@/features/roles/schemas/role-update.schema";
import { Dialog } from "@/components/modal/dialog";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { resourceOptionsForLayer } from "@/lib/permissions/layer-mappings";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import type { PermissionMap, UserLayer } from "@/lib/permissions/constants";

export type RoleEditTarget = {
  _id: string;
  name: string;
  description: string;
  userLayer: UserLayer;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionMap;
};

/**
 * Edit/view modal for an existing Role - separate from role-create-dialog.tsx
 * (kept untouched) so the Management page's "Add role" flow is never at risk
 * of regressing. `userLayer` is immutable (role-update.schema.ts never
 * accepts it) and system roles can't have `isActive` turned off - the
 * server re-enforces both regardless of what this form allows.
 */
export function RoleEditDialog({
  open,
  onClose,
  onSaved,
  role,
  readOnly,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  role: RoleEditTarget | null;
  readOnly?: boolean;
}) {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const resources = role ? resourceOptionsForLayer(role.userLayer) : [];

  const form = useForm<RoleUpdateInput>({
    resolver: zodResolver(roleUpdateSchema),
    defaultValues: { name: "", description: "", permissions: {}, isActive: true },
  });

  useEffect(() => {
    if (!open || !role) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets form state each time the dialog opens for a new role, not a render-time state sync
    setGlobalError(null);
    form.reset({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isActive: role.isActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role]);

  async function onSubmit(values: RoleUpdateInput) {
    if (!role) return;
    setGlobalError(null);
    try {
      await apiClient.patch(`/api/roles/${role._id}`, values);
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

  const disabled = Boolean(readOnly);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={readOnly ? "View role" : "Edit role"}
      description={
        readOnly
          ? "This role's details and permission matrix."
          : "Update the name, description, and permission matrix this role grants."
      }
      preventClose={form.formState.isSubmitting}
      className="max-w-[80vw]"
    >
      {globalError && (
        <div className="mb-4">
          <Alert variant="danger">{globalError}</Alert>
        </div>
      )}
      <Form form={form} onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<RoleUpdateInput>
            name="name"
            label="Name"
            required
            render={(f) => (
              <Input
                id={f.id}
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
                disabled={disabled}
              />
            )}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Layer</p>
            <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
              {role?.userLayer ?? "—"}
            </p>
          </div>
        </div>
        <FormField<RoleUpdateInput>
          name="description"
          label="Description"
          render={(f) => (
            <Textarea
              id={f.id}
              value={f.value as string}
              onChange={(e) => f.onChange(e.target.value)}
              onBlur={f.onBlur}
              invalid={f.invalid}
              rows={2}
              disabled={disabled}
            />
          )}
        />
        {!readOnly && role?.isSystem && (
          <Alert variant="info">
            System roles can&apos;t be deactivated or deleted, but their permissions can still be edited.
          </Alert>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Permissions</p>
          <Controller
            name="permissions"
            control={form.control}
            render={({ field }) => (
              <PermissionMatrix
                resources={resources}
                value={field.value as PermissionMap}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <SubmitButton loading={form.formState.isSubmitting}>Save changes</SubmitButton>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </Form>
    </Dialog>
  );
}
