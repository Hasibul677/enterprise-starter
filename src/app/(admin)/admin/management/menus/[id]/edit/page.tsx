"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuUpdateSchema, type MenuUpdateInput } from "@/features/menus/schemas/menu-update.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { CORE_RESOURCES, MENU_SCOPES } from "@/lib/permissions/constants";

const SCOPE_OPTIONS = [
  { value: MENU_SCOPES.SUPER_ADMIN_ADMIN, label: "Super Admin / Admin" },
  { value: MENU_SCOPES.COMPANY_ADMIN_MODERATOR, label: "Company Admin / Moderator" },
];

const RESOURCE_KEY_OPTIONS = Object.values(CORE_RESOURCES).map((key) => ({ value: key, label: key.replace(/_/g, " ") }));

type MenuDetail = {
  _id: string;
  name: string;
  label: string;
  route?: string | null;
  resourceKey?: string | null;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  scope?: string | null;
};

function EditMenuForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("layer") ? `/admin/management?layer=${searchParams.get("layer")}` : "/admin/management";
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<MenuUpdateInput>({ resolver: zodResolver(menuUpdateSchema) });

  useEffect(() => {
    apiClient
      .get<{ menu: MenuDetail }>(`/api/menus/${id}`)
      .then(({ menu }) => {
        form.reset({
          name: menu.name,
          label: menu.label,
          route: menu.route ?? null,
          resourceKey: menu.resourceKey ?? null,
          sortOrder: menu.sortOrder,
          isActive: menu.isActive,
          isVisible: menu.isVisible,
          scope: (menu.scope ?? undefined) as MenuUpdateInput["scope"],
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: MenuUpdateInput) {
    setGlobalError(null);
    try {
      await apiClient.patch(`/api/menus/${id}`, values);
      router.push(returnTo);
    } catch (err) {
      if (err instanceof ApiClientError) {
        applyServerErrors(form.setError, err.errors);
        setGlobalError(err.errors?.length ? null : err.message);
      } else {
        setGlobalError("Something went wrong.");
      }
    }
  }

  if (loading) return <ContentContainer><Loading /></ContentContainer>;

  return (
    <ContentContainer>
      <PageHeader title="Edit menu item" backHref={returnTo} />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-lg">
        <FormField<MenuUpdateInput> name="name" label="Name" render={(f) => (
          <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<MenuUpdateInput> name="label" label="Label" render={(f) => (
          <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<MenuUpdateInput> name="route" label="Route" render={(f) => (
          <Input id={f.id} value={(f.value as string) ?? ""} onChange={(e) => f.onChange(e.target.value || null)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<MenuUpdateInput> name="scope" label="Menu Scope" render={(f) => (
          <Select
            id={f.id}
            value={(f.value as string) ?? ""}
            onChange={(e) => f.onChange(e.target.value)}
            options={SCOPE_OPTIONS}
          />
        )} />
        <FormField<MenuUpdateInput> name="resourceKey" label="Resource key (optional)" description="Which permission gates this menu's visibility." render={(f) => (
          <Select
            id={f.id}
            value={(f.value as string) ?? ""}
            onChange={(e) => f.onChange(e.target.value || null)}
            placeholder="No permission gate"
            options={RESOURCE_KEY_OPTIONS}
          />
        )} />
        <FormField<MenuUpdateInput> name="sortOrder" label="Sort order" render={(f) => (
          <Input id={f.id} type="number" value={f.value as number} onChange={(e) => f.onChange(Number(e.target.value))} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <Controller name="isActive" control={form.control} render={({ field }) => (
          <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Active" />
        )} />
        <Controller name="isVisible" control={form.control} render={({ field }) => (
          <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Visible in sidebar" />
        )} />
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Save changes</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push(returnTo)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}

export default function EditMenuPage() {
  return (
    <Suspense fallback={<ContentContainer><Loading /></ContentContainer>}>
      <EditMenuForm />
    </Suspense>
  );
}
