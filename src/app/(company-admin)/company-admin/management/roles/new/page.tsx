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
import { SCOPE_RESOURCES } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS } from "@/lib/permissions/constants";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

// Matches SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR in role-hierarchy.ts.
const RESOURCES = SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR.map((key) => ({ key, label: key.replace(/_/g, " ") }));

const RETURN_TO = `/company-admin/management?layer=${USER_LAYERS.MODERATOR}`;

/**
 * A Company Admin can create unlimited roles, but only ever for the
 * MODERATOR layer it manages (requirement #4) - the target layer is fixed
 * and never shown here; role.service.ts#createRole force-sets it (and
 * `managedBy` to this actor) server-side regardless of what's submitted.
 */
export default function NewCompanyAdminRolePage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RoleCreateInput>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: { name: "", slug: "", description: "", userLayer: USER_LAYERS.MODERATOR, permissions: {}, isActive: true },
  });

  async function onSubmit(values: RoleCreateInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/roles", values);
      router.push(RETURN_TO);
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
      <PageHeader
        title="Add moderator role"
        description="Define a name and the permission matrix this role grants to your moderators."
        backHref={RETURN_TO}
      />
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
          <Button type="button" variant="secondary" onClick={() => router.push(RETURN_TO)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
