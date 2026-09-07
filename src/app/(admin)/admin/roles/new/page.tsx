"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleCreateSchema, type RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

const RESOURCES = [
  { key: CORE_RESOURCES.USERS, label: "Users" },
  { key: CORE_RESOURCES.ROLES, label: "Roles" },
  { key: CORE_RESOURCES.MENUS, label: "Menus" },
];

export default function NewRolePage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RoleCreateInput>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: { name: "", slug: "", description: "", permissions: {}, isActive: true },
  });

  async function onSubmit(values: RoleCreateInput) {
    setGlobalError(null);
    try {
      // The server independently re-validates this whole permission map via
      // roleCreateSchema + createRole() - a tampered client payload gains nothing.
      await apiClient.post("/api/roles", values);
      router.push("/admin/roles");
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
      <PageHeader title="Add role" description="Define a name and the permission matrix this role grants." />
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
          <Button type="button" variant="secondary" onClick={() => router.push("/admin/roles")}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
