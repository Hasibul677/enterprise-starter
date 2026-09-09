"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleUpdateSchema, type RoleUpdateInput } from "@/features/roles/schemas/role-update.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { PermissionMatrix } from "@/components/permission/permission-matrix";
import { SCOPE_RESOURCES } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type PermissionMap } from "@/lib/permissions/constants";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

const RESOURCES = SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR.map((key) => ({ key, label: key.replace(/_/g, " ") }));

const RETURN_TO = `/company-admin/management?layer=${USER_LAYERS.MODERATOR}`;

type RoleDetail = {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  permissions: PermissionMap;
};

/**
 * Deactivating this role while moderators still hold it is allowed
 * (requirement #16/#17) - the live permission-sync (permissionVersion bump
 * in role.service.ts + use-permission-sync.ts on the client) gracefully
 * degrades any affected, logged-in moderator instead of blocking the edit.
 */
export default function EditCompanyAdminRolePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RoleUpdateInput>({ resolver: zodResolver(roleUpdateSchema) });

  useEffect(() => {
    apiClient
      .get<{ role: RoleDetail }>(`/api/roles/${id}`)
      .then(({ role }) => {
        form.reset({ name: role.name, description: role.description, isActive: role.isActive, permissions: role.permissions });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: RoleUpdateInput) {
    setGlobalError(null);
    try {
      await apiClient.patch(`/api/roles/${id}`, values);
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

  if (loading) return <ContentContainer><Loading /></ContentContainer>;

  return (
    <ContentContainer>
      <PageHeader title="Edit moderator role" description="Update this role's details and permissions." backHref={RETURN_TO} />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-2xl">
        <FormField<RoleUpdateInput> name="name" label="Name" render={(f) => (
          <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<RoleUpdateInput> name="description" label="Description" render={(f) => (
          <Textarea id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} rows={2} />
        )} />
        <Controller name="isActive" control={form.control} render={({ field }) => (
          <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Active" />
        )} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Permissions</p>
          <Controller
            name="permissions"
            control={form.control}
            render={({ field }) => (
              <PermissionMatrix resources={RESOURCES} value={(field.value as PermissionMap) ?? {}} onChange={field.onChange} />
            )}
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Save changes</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push(RETURN_TO)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
