"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userUpdateSchema, type UserUpdateInput } from "@/features/users/schemas/user-update.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { Loading } from "@/components/feedback/loading";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { PermissionGuard } from "@/components/permission/permission-guard";
import type { UserLayer } from "@/lib/permissions/constants";

type RoleOption = { _id: string; name: string };
type UserDetail = {
  _id: string;
  firstName: string;
  lastName: string;
  status: string;
  userLayer: UserLayer;
  roles: { _id: string; name: string }[];
};

/**
 * Shared "edit user" form. `allowRoleEdit` is off for
 * `/company-admin/users/[id]/edit`: a COMPANY_ADMIN's only assignable roles
 * target the MODERATOR layer it already belongs to, and it can only ever
 * change WHICH such role, not the user's layer itself - out of scope to
 * simplify this form for now; the server independently rejects any change
 * it doesn't authorize either way (requirement #47).
 *
 * Role options come from GET /api/roles/assignable?layer=<the user's own,
 * fixed layer>, not GET /api/roles (the latter needs a `roles.view` grant an
 * Admin may not have, and is admin-area-only so a Company Admin can never
 * reach it) - see that route's own doc comment. The target's CURRENT
 * role(s) are merged in even if not "assignable" (e.g. a custom role owned
 * by a different Company Admin), purely so the picker shows a real label
 * instead of a blank entry; submitting with that role UNCHANGED is still
 * accepted server-side (see user.service.ts#updateUser).
 */
export function UserEditView({
  basePath,
  allowRoleEdit,
  listHref,
}: {
  basePath: string;
  allowRoleEdit: boolean;
  /** Where "Cancel"/success redirects to - defaults to `basePath` when omitted. */
  listHref?: string;
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const returnTo = listHref ?? basePath;

  const form = useForm<UserUpdateInput>({ resolver: zodResolver(userUpdateSchema) });

  useEffect(() => {
    apiClient
      .get<{ user: UserDetail }>(`/api/users/${id}`)
      .then(async ({ user }) => {
        const roleList = allowRoleEdit
          ? await apiClient.get<RoleOption[]>("/api/roles/assignable", { query: { layer: user.userLayer } }).catch(() => [])
          : [];
        const merged = new Map(roleList.map((r) => [r._id, r] as const));
        for (const r of user.roles) {
          if (!merged.has(r._id)) merged.set(r._id, { _id: r._id, name: r.name });
        }
        setRoles(Array.from(merged.values()));
        form.reset({
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status as UserUpdateInput["status"],
          roleIds: user.roles.map((r) => r._id),
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: UserUpdateInput) {
    setGlobalError(null);
    try {
      const payload = allowRoleEdit ? values : { firstName: values.firstName, lastName: values.lastName, status: values.status };
      await apiClient.patch(`/api/users/${id}`, payload);
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
      <PageHeader
        title="Edit user"
        description="Update profile, roles, and account status."
        backHref={returnTo}
      />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<UserUpdateInput> name="firstName" label="First name" render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
          <FormField<UserUpdateInput> name="lastName" label="Last name" render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
        </div>
        {allowRoleEdit && (
          <FormField<UserUpdateInput> name="roleIds" label="Roles" render={(f) => (
            <MultiSelect options={roles.map((r) => ({ value: r._id, label: r.name }))} value={(f.value as string[]) ?? []} onChange={f.onChange} />
          )} />
        )}
        <PermissionGuard resource="users" action="edit">
          <FormField<UserUpdateInput> name="status" label="Account status" render={(f) => (
            <Select
              id={f.id}
              value={f.value as string}
              onChange={(e) => f.onChange(e.target.value)}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "WARNING", label: "Warning" },
                { value: "BLOCKED", label: "Blocked" },
                { value: "DISABLED", label: "Disabled" },
              ]}
            />
          )} />
        </PermissionGuard>
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Save changes</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push(returnTo)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
