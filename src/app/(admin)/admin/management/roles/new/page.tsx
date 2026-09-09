"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleCreateSchema, type RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { SCOPE_RESOURCES } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

// Matches SCOPE_RESOURCES.SUPER_ADMIN_ADMIN in role-hierarchy.ts - the same
// source of truth menu-visibility/grant validation already uses, rather
// than a separately hand-maintained resource list.
const RESOURCES = SCOPE_RESOURCES.SUPER_ADMIN_ADMIN.map((key) => ({ key, label: key.replace(/_/g, " ") }));

// A role's target layer is immutable after creation (see role-update.schema.ts,
// which never accepts it) - this is the only place it's ever chosen. Matches
// CREATABLE_ROLE_LAYERS_BY[SUPER_ADMIN] in role-hierarchy.ts.
const LAYER_OPTIONS = [
  { value: USER_LAYERS.ADMIN, label: "Admin" },
  { value: USER_LAYERS.COMPANY_ADMIN, label: "Company Admin" },
  { value: USER_LAYERS.CUSTOMER, label: "Customer" },
];

function NewRoleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLayer = searchParams.get("layer");
  const defaultLayer = (LAYER_OPTIONS.some((o) => o.value === requestedLayer) ? requestedLayer : USER_LAYERS.ADMIN) as UserLayer;
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RoleCreateInput>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: { name: "", slug: "", description: "", userLayer: defaultLayer, permissions: {}, isActive: true },
  });

  async function onSubmit(values: RoleCreateInput) {
    setGlobalError(null);
    try {
      // The server independently re-validates this whole permission map via
      // roleCreateSchema + createRole() - a tampered client payload gains nothing.
      await apiClient.post("/api/roles", values);
      router.push(`/admin/management?layer=${values.userLayer}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        applyServerErrors(form.setError, err.errors);
        setGlobalError(err.errors?.length ? null : err.message);
      } else {
        setGlobalError("Something went wrong.");
      }
    }
  }

  const cancelHref = `/admin/management?layer=${defaultLayer}`;

  return (
    <ContentContainer>
      <PageHeader title="Add role" description="Define a name and the permission matrix this role grants." backHref={cancelHref} />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-2xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<RoleCreateInput> name="name" label="Name" required render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
          <FormField<RoleCreateInput> name="slug" label="Slug" required description="Lowercase, hyphenated." render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
        </div>
        <FormField<RoleCreateInput> name="userLayer" label="Target layer" required description="Which user layer this role is assignable to - cannot be changed later." render={(f) => (
          <Select id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} options={LAYER_OPTIONS} invalid={f.invalid} />
        )} />
        <FormField<RoleCreateInput> name="description" label="Description" render={(f) => (
          <Textarea id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} rows={2} />
        )} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Permissions</p>
          <Controller
            name="permissions"
            control={form.control}
            render={({ field }) => (
              <PermissionMatrix resources={RESOURCES} value={field.value as never} onChange={field.onChange} />
            )}
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create role</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}

export default function NewRolePage() {
  return (
    <Suspense fallback={<ContentContainer><Loading /></ContentContainer>}>
      <NewRoleForm />
    </Suspense>
  );
}
