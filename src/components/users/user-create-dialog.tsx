"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userCreateSchema, type UserCreateInput } from "@/features/users/schemas/user-create.schema";
import { Dialog } from "@/components/modal/dialog";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { CREATABLE_LAYERS_BY } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";

type RoleOption = { _id: string; name: string; slug: string };

export const LAYER_LABELS: Record<UserLayer, string> = {
  [USER_LAYERS.SUPER_ADMIN]: "Super Admin",
  [USER_LAYERS.ADMIN]: "Admin",
  [USER_LAYERS.COMPANY_ADMIN]: "Company Admin",
  [USER_LAYERS.MODERATOR]: "Moderator",
  [USER_LAYERS.CUSTOMER]: "Customer",
};

/**
 * Shared "create user" modal. Roles are dynamic and unlimited, but every user
 * still belongs to exactly one of the 5 fixed layers - so this form is either:
 * - locked to one layer via `fixedUserLayer` (Company Admin creating a
 *   MODERATOR) - the layer picker is hidden entirely, or
 * - a layer picker (Super Admin/Admin) showing whichever layers
 *   CREATABLE_LAYERS_BY grants the current actor, followed by a role picker
 *   scoped to whichever layer is currently selected.
 * Both pickers only ever show what GET /api/roles/assignable?layer=...
 * returns for the CURRENT actor - see role-hierarchy.ts CREATABLE_LAYERS_BY/
 * CREATABLE_ROLE_LAYERS_BY. This is UX convenience only - the server
 * independently re-validates the target layer and every requested role on
 * submit.
 */
export function UserCreateDialog({
  open,
  onClose,
  onSaved,
  fixedUserLayer,
  initialLayer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  fixedUserLayer?: UserLayer;
  /** Preselects the layer picker (e.g. from the management area's active tab) when it's one of `creatableLayers`; ignored otherwise. */
  initialLayer?: UserLayer;
}) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const actorLayer = useAuthStore((s) => s.userLayer);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const creatableLayers = useMemo(
    () => CREATABLE_LAYERS_BY[isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : actorLayer] ?? [],
    [isSuperAdmin, actorLayer]
  );

  const [selectedLayer, setSelectedLayer] = useState<UserLayer | undefined>(
    fixedUserLayer ?? (initialLayer && creatableLayers.includes(initialLayer) ? initialLayer : creatableLayers[0])
  );
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", roleIds: [], status: "ACTIVE" },
  });

  useEffect(() => {
    if (!open) return;
    const layer =
      fixedUserLayer ?? (initialLayer && creatableLayers.includes(initialLayer) ? initialLayer : creatableLayers[0]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets form state each time the dialog opens, not a render-time state sync
    setSelectedLayer(layer);
    setGlobalError(null);
    form.reset({ firstName: "", lastName: "", email: "", password: "", roleIds: [], status: "ACTIVE" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !selectedLayer) return;
    apiClient
      .get<RoleOption[]>("/api/roles/assignable", { query: { layer: selectedLayer } })
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [open, selectedLayer]);

  // Changing layer invalidates whatever roles were picked for the old one.
  useEffect(() => {
    form.setValue("roleIds", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer]);

  async function onSubmit(values: UserCreateInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/users", values);
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
      title={fixedUserLayer === USER_LAYERS.MODERATOR ? "Add moderator" : "Add user"}
      description={
        fixedUserLayer === USER_LAYERS.MODERATOR
          ? "Create a new moderator account you manage."
          : "Create a new user account and assign roles."
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField<UserCreateInput>
            name="firstName"
            label="First name"
            required
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
          <FormField<UserCreateInput>
            name="lastName"
            label="Last name"
            required
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
          <FormField<UserCreateInput>
            name="email"
            label="Email"
            required
            render={(f) => (
              <Input
                id={f.id}
                type="email"
                placeholder="name@example.com"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<UserCreateInput>
            name="password"
            label="Temporary password"
            required
            render={(f) => (
              <PasswordInput
                id={f.id}
                placeholder="Enter a temporary password"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          {!fixedUserLayer && creatableLayers.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">User layer</label>
              <Select
                value={selectedLayer}
                onChange={(e) => setSelectedLayer(e.target.value as UserLayer)}
                placeholder="Select a layer"
                options={creatableLayers.map((layer) => ({ value: layer, label: LAYER_LABELS[layer] }))}
              />
            </div>
          )}
        </div>
        <FormField<UserCreateInput>
          name="roleIds"
          label="Role"
          required
          render={(f) => (
            <MultiSelect
              options={roles.map((r) => ({ value: r._id, label: r.name }))}
              value={(f.value as string[]) ?? []}
              onChange={(v) => f.onChange(v)}
            />
          )}
        />
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create user</SubmitButton>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
