"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuUpdateSchema, type MenuUpdateInput } from "@/features/menus/schemas/menu-update.schema";
import { Dialog } from "@/components/modal/dialog";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { CORE_RESOURCES, MENU_SCOPES } from "@/lib/permissions/constants";

const RESOURCE_KEY_OPTIONS = Object.values(CORE_RESOURCES).map((key) => ({
  value: key,
  label: key.replace(/_/g, " "),
}));

const SCOPE_OPTIONS = [
  { value: MENU_SCOPES.SUPER_ADMIN_ADMIN, label: "Super Admin / Admin" },
  { value: MENU_SCOPES.COMPANY_ADMIN_MODERATOR, label: "Company Admin / Moderator" },
];

export type MenuEditTarget = {
  _id: string;
  name: string;
  key: string;
  label: string;
  slug: string;
  route: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  resourceKey: string | null;
  scope: (typeof MENU_SCOPES)[keyof typeof MENU_SCOPES] | null;
};

type MenuOption = { _id: string; name: string; level: number };

/**
 * Edit/view modal for an existing Menu item - separate from
 * menu-create-dialog.tsx (kept untouched). Covers "manage menu permissions/
 * access": per menu.model.ts, that's literally the resourceKey/scope/
 * isVisible/isActive fields edited here. `key` never changes after creation
 * (see CLAUDE.md) and `slug` isn't accepted by menu-update.schema.ts either -
 * both render as read-only text.
 */
export function MenuEditDialog({
  open,
  onClose,
  onSaved,
  menu,
  readOnly,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  menu: MenuEditTarget | null;
  readOnly?: boolean;
}) {
  const [parents, setParents] = useState<MenuOption[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<MenuUpdateInput>({
    resolver: zodResolver(menuUpdateSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!open || !menu) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets form state each time the dialog opens for a new menu, not a render-time state sync
    setGlobalError(null);
    form.reset({
      name: menu.name,
      label: menu.label,
      route: menu.route,
      parentId: menu.parentId,
      sortOrder: menu.sortOrder,
      isActive: menu.isActive,
      isVisible: menu.isVisible,
      resourceKey: menu.resourceKey,
      scope: menu.scope ?? undefined,
    });
    apiClient
      .get<MenuOption[]>("/api/menus")
      .then((all) => setParents(all.filter((m) => m.level < 3 && m._id !== menu._id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menu]);

  async function onSubmit(values: MenuUpdateInput) {
    if (!menu) return;
    setGlobalError(null);
    try {
      // Depth/cycle validation happens server-side in validateMenuHierarchy()
      // regardless of what this form allows the user to pick.
      await apiClient.patch(`/api/menus/${menu._id}`, values);
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
      title={readOnly ? "View menu item" : "Edit menu item"}
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
          <FormField<MenuUpdateInput>
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
          <FormField<MenuUpdateInput>
            name="label"
            label="Label"
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
            <p className="mb-1.5 text-sm font-medium text-ink">Key</p>
            <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-soft">{menu?.key}</p>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Slug</p>
            <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-soft">{menu?.slug}</p>
          </div>
          <FormField<MenuUpdateInput>
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
                disabled={disabled}
              />
            )}
          />
          <FormField<MenuUpdateInput>
            name="sortOrder"
            label="Sort order"
            render={(f) => (
              <Input
                id={f.id}
                type="number"
                value={f.value as number}
                onChange={(e) => f.onChange(Number(e.target.value))}
                onBlur={f.onBlur}
                invalid={f.invalid}
                disabled={disabled}
              />
            )}
          />
          <FormField<MenuUpdateInput>
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
                disabled={disabled}
              />
            )}
          />
          <FormField<MenuUpdateInput>
            name="scope"
            label="Scope"
            required
            render={(f) => (
              <Select
                id={f.id}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value)}
                options={SCOPE_OPTIONS}
                disabled={disabled}
              />
            )}
          />
          <FormField<MenuUpdateInput>
            name="parentId"
            label="Parent menu"
            render={(f) => (
              <Select
                id={f.id}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                placeholder="No parent (top level)"
                options={parents.map((p) => ({ value: p._id, label: `${"—".repeat(p.level - 1)} ${p.name}` }))}
                disabled={disabled}
              />
            )}
          />
        </div>
        <div className="flex gap-6">
          <Controller
            name="isActive"
            control={form.control}
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onChange={field.onChange}
                disabled={disabled}
                label="Active"
                id="menu-is-active"
              />
            )}
          />
          <Controller
            name="isVisible"
            control={form.control}
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onChange={field.onChange}
                disabled={disabled}
                label="Visible"
                id="menu-is-visible"
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
