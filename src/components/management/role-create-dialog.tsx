"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleCreateSchema, type RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
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
import type { UserLayer } from "@/lib/permissions/constants";

const EMPTY_DEFAULTS = (layer: UserLayer): RoleCreateInput => ({
  name: "",
  slug: "",
  description: "",
  userLayer: layer,
  permissions: {},
  isActive: true,
});

/**
 * Create-only modal for a dynamic Role, fixed to whichever layer tab is
 * currently selected on the Management page - no in-dialog layer picker,
 * since the "Add Role" button that opens this is itself only rendered when
 * CREATABLE_ROLE_LAYERS_BY already authorizes the actor to create a role
 * for exactly this layer (see management-view.tsx). The server
 * independently re-validates the target layer regardless (role.service.ts
 * #createRole). Editing an existing role's permissions happens from the
 * per-user "Role" dialog (user-role-dialog.tsx), not here.
 */
export function RoleCreateDialog({
  open,
  onClose,
  onSaved,
  layer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  layer: UserLayer;
}) {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const resources = resourceOptionsForLayer(layer);

  const form = useForm<RoleCreateInput>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: EMPTY_DEFAULTS(layer),
  });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets form state each time the dialog opens, not a render-time state sync
    setGlobalError(null);
    form.reset(EMPTY_DEFAULTS(layer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layer]);

  async function onSubmit(values: RoleCreateInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/roles", values);
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
      title="Add role"
      description="Define a name and the permission matrix this role grants."
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
          <FormField<RoleCreateInput>
            name="name"
            label="Name"
            required
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. Content Moderator"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<RoleCreateInput>
            name="slug"
            label="Slug"
            required
            description="Lowercase, hyphenated."
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. content-moderator"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
        </div>
        <FormField<RoleCreateInput>
          name="description"
          label="Description"
          render={(f) => (
            <Textarea
              id={f.id}
              placeholder="What is this role for?"
              value={f.value as string}
              onChange={(e) => f.onChange(e.target.value)}
              onBlur={f.onBlur}
              invalid={f.invalid}
              rows={2}
            />
          )}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Permissions</p>
          <Controller
            name="permissions"
            control={form.control}
            render={({ field }) => (
              <PermissionMatrix resources={resources} value={field.value as never} onChange={field.onChange} />
            )}
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create role</SubmitButton>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
