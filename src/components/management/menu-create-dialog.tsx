"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuCreateSchema, type MenuCreateInput } from "@/features/menus/schemas/menu-create.schema";
import { Dialog } from "@/components/modal/dialog";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { menuScopeForLayer } from "@/lib/permissions/layer-mappings";
import { CORE_RESOURCES, MENU_SCOPES, type UserLayer } from "@/lib/permissions/constants";

type MenuOption = { _id: string; name: string; level: number };

const RESOURCE_KEY_OPTIONS = Object.values(CORE_RESOURCES).map((key) => ({
  value: key,
  label: key.replace(/_/g, " "),
}));

function defaultValuesFor(layer: UserLayer): MenuCreateInput {
  return {
    name: "",
    key: "",
    label: "",
    slug: "",
    parentId: null,
    sortOrder: 0,
    isActive: true,
    isVisible: true,
    resourceKey: null,
    // CUSTOMER has no Menu.scope of its own (menuScopeForLayer returns null) -
    // falls back to the Super Admin / Admin scope, matching this form's only
    // other option, rather than leaving the required field unset.
    scope: menuScopeForLayer(layer) ?? MENU_SCOPES.SUPER_ADMIN_ADMIN,
  };
}

/**
 * Create-only modal for a Menu item, fixed to the Menu.scope matching
 * whichever layer tab is currently selected - "Add Menu" is only ever shown
 * from the admin area (see management-view.tsx), so scope is always one of
 * the 2 values Menu.scope supports. Up to 3 levels deep; depth/cycle
 * validation happens server-side in validateMenuHierarchy() regardless of
 * what this form allows.
 */
export function MenuCreateDialog({
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
  const [parents, setParents] = useState<MenuOption[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<MenuCreateInput>({
    resolver: zodResolver(menuCreateSchema),
    defaultValues: defaultValuesFor(layer),
  });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets form state each time the dialog opens, not a render-time state sync
    setGlobalError(null);
    form.reset(defaultValuesFor(layer));
    // Only levels 1-2 can be a parent (level 3 is the maximum depth).
    apiClient.get<MenuOption[]>("/api/menus").then((all) => setParents(all.filter((m) => m.level < 3)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layer]);

  async function onSubmit(values: MenuCreateInput) {
    setGlobalError(null);
    try {
      // Depth/cycle validation happens server-side in validateMenuHierarchy()
      // regardless of what this form allows the user to pick.
      await apiClient.post("/api/menus", values);
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
      title="Add menu item"
      description="Up to 3 levels deep."
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
          <FormField<MenuCreateInput>
            name="name"
            label="Name"
            required
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. Users"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="label"
            label="Label"
            required
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. Users"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="slug"
            label="Slug"
            required
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. users"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="key"
            label="Key"
            required
            description="Stable identifier, never changes after creation."
            render={(f) => (
              <Input
                id={f.id}
                placeholder="e.g. users"
                value={f.value as string}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="route"
            label="Route (optional)"
            description="Leave empty for a parent-only grouping item."
            render={(f) => (
              <Input
                id={f.id}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                onBlur={f.onBlur}
                invalid={f.invalid}
                placeholder="/example"
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="sortOrder"
            label="Sort order"
            render={(f) => (
              <Input
                id={f.id}
                type="number"
                placeholder="0"
                value={f.value as number}
                onChange={(e) => f.onChange(Number(e.target.value))}
                onBlur={f.onBlur}
                invalid={f.invalid}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="resourceKey"
            label="Resource key (optional)"
            description="Which permission gates this menu's visibility - leave empty to always show it to anyone in scope."
            render={(f) => (
              <Select
                id={f.id}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                placeholder="No permission gate"
                options={RESOURCE_KEY_OPTIONS}
              />
            )}
          />
          <FormField<MenuCreateInput>
            name="parentId"
            label="Parent menu"
            render={(f) => (
              <Select
                id={f.id}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                placeholder="No parent (top level)"
                options={parents.map((p) => ({ value: p._id, label: `${"—".repeat(p.level - 1)} ${p.name}` }))}
              />
            )}
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create menu item</SubmitButton>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
