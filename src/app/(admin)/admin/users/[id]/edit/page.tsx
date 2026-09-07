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

type RoleOption = { _id: string; name: string };
type UserDetail = {
  _id: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: { _id: string }[];
};

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<UserUpdateInput>({ resolver: zodResolver(userUpdateSchema) });

  useEffect(() => {
    Promise.all([
      apiClient.get<RoleOption[]>("/api/roles"),
      apiClient.get<{ user: UserDetail }>(`/api/users/${id}`),
    ])
      .then(([roleList, { user }]) => {
        setRoles(roleList);
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
      await apiClient.patch(`/api/users/${id}`, values);
      router.push("/admin/users");
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
      <PageHeader title="Edit user" description="Update profile, roles, and account status." />
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
        <FormField<UserUpdateInput> name="roleIds" label="Roles" render={(f) => (
          <MultiSelect options={roles.map((r) => ({ value: r._id, label: r.name }))} value={(f.value as string[]) ?? []} onChange={f.onChange} />
        )} />
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
          <Button type="button" variant="secondary" onClick={() => router.push("/admin/users")}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
