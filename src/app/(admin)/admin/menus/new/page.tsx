"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuCreateSchema, type MenuCreateInput } from "@/features/menus/schemas/menu-create.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { MENU_SCOPES } from "@/lib/permissions/constants";

type MenuOption = { _id: string; name: string; level: number };

const SCOPE_OPTIONS = [
  { value: MENU_SCOPES.SUPER_ADMIN_ADMIN, label: "Super Admin / Admin" },
  { value: MENU_SCOPES.NORMAL_ADMIN_MODERATOR, label: "Normal Admin / Moderator" },
];

export default function NewMenuPage() {
  const router = useRouter();
  const [parents, setParents] = useState<MenuOption[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    // Only levels 1-2 can be a parent (level 3 is the maximum depth).
    apiClient.get<MenuOption[]>("/api/menus").then((all) => setParents(all.filter((m) => m.level < 3)));
  }, []);

  const form = useForm<MenuCreateInput>({
    resolver: zodResolver(menuCreateSchema),
    defaultValues: {
      name: "",
      key: "",
      label: "",
      slug: "",
      parentId: null,
      sortOrder: 0,
      isActive: true,
      isVisible: true,
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    },
  });

  async function onSubmit(values: MenuCreateInput) {
    setGlobalError(null);
    try {
      // Depth/cycle validation happens server-side in validateMenuHierarchy()
      // regardless of what this form allows the user to pick.
      await apiClient.post("/api/menus", values);
      router.push("/admin/menus");
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
    <ContentContainer>
      <PageHeader title="Add menu item" description="Up to 3 levels deep." backHref="/admin/menus" />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<MenuCreateInput> name="name" label="Name" required render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
          <FormField<MenuCreateInput> name="label" label="Label" required render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
        </div>
        <FormField<MenuCreateInput> name="slug" label="Slug" required render={(f) => (
          <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<MenuCreateInput> name="key" label="Key" required description="Stable identifier, never changes after creation." render={(f) => (
          <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<MenuCreateInput> name="route" label="Route (optional)" description="Leave empty for a parent-only grouping item." render={(f) => (
          <Input id={f.id} value={(f.value as string) ?? ""} onChange={(e) => f.onChange(e.target.value || null)} onBlur={f.onBlur} invalid={f.invalid} placeholder="/example" />
        )} />
        <FormField<MenuCreateInput> name="scope" label="Menu Scope" required description="Which dashboard tree this item belongs to - required for every menu." render={(f) => (
          <Select
            id={f.id}
            value={f.value as string}
            onChange={(e) => f.onChange(e.target.value)}
            options={SCOPE_OPTIONS}
          />
        )} />
        <FormField<MenuCreateInput> name="parentId" label="Parent menu" render={(f) => (
          <Select
            id={f.id}
            value={(f.value as string) ?? ""}
            onChange={(e) => f.onChange(e.target.value || null)}
            placeholder="No parent (top level)"
            options={parents.map((p) => ({ value: p._id, label: `${"—".repeat(p.level - 1)} ${p.name}` }))}
          />
        )} />
        <FormField<MenuCreateInput> name="sortOrder" label="Sort order" render={(f) => (
          <Input id={f.id} type="number" value={f.value as number} onChange={(e) => f.onChange(Number(e.target.value))} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create menu item</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push("/admin/menus")}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
