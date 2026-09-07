"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userCreateSchema, type UserCreateInput } from "@/features/users/schemas/user-create.schema";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

type RoleOption = { _id: string; name: string };

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<RoleOption[]>("/api/roles").then(setRoles).catch(() => setRoles([]));
  }, []);

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", roleIds: [], status: "ACTIVE" },
  });

  async function onSubmit(values: UserCreateInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/users", values);
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

  return (
    <ContentContainer>
      <PageHeader title="Add user" description="Create a new user account and assign roles." />
      {globalError && <div className="mb-4"><Alert variant="danger">{globalError}</Alert></div>}
      <Form form={form} onSubmit={onSubmit} className="max-w-lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<UserCreateInput> name="firstName" label="First name" required render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
          <FormField<UserCreateInput> name="lastName" label="Last name" required render={(f) => (
            <Input id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
          )} />
        </div>
        <FormField<UserCreateInput> name="email" label="Email" required render={(f) => (
          <Input id={f.id} type="email" value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<UserCreateInput> name="password" label="Temporary password" required render={(f) => (
          <PasswordInput id={f.id} value={f.value as string} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} invalid={f.invalid} />
        )} />
        <FormField<UserCreateInput> name="roleIds" label="Roles" required render={(f) => (
          <MultiSelect
            options={roles.map((r) => ({ value: r._id, label: r.name }))}
            value={(f.value as string[]) ?? []}
            onChange={(v) => f.onChange(v)}
          />
        )} />
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create user</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push("/admin/users")}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
