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
import type { RoleSlug } from "@/lib/permissions/constants";

type RoleOption = { _id: string; name: string; slug: string };

/**
 * Shared "create user" form (requirement #8). The role picker is either:
 * - a fixed, hidden role (`fixedRoleSlug`) - used by
 *   `/normal-admin/users/new`, which always creates a MODERATOR - or
 * - a picker showing whatever GET /api/roles/assignable returns - used by
 *   `/admin/users/new` (Super Admin sees ADMIN/NORMAL_ADMIN/CUSTOMER, Admin
 *   sees only CUSTOMER).
 * That endpoint (not GET /api/roles, which needs a `roles.view` grant an
 * Admin may not have and is admin-area-only so a Normal Admin can never
 * reach it at all) already returns only the roles the CURRENT actor is
 * authorized to assign - see role-hierarchy.ts CREATABLE_ROLES_BY. Either
 * way this is UX convenience only - the server independently re-validates
 * every requested role via canAssignRole() on submit (requirement #47).
 */
export function UserCreateView({ basePath, fixedRoleSlug }: { basePath: string; fixedRoleSlug?: RoleSlug }) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<RoleOption[]>("/api/roles/assignable").then(setRoles).catch(() => setRoles([]));
  }, []);

  const roleOptions = fixedRoleSlug ? roles.filter((r) => r.slug === fixedRoleSlug) : roles;
  const fixedRole = fixedRoleSlug ? roles.find((r) => r.slug === fixedRoleSlug) : undefined;

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", roleIds: [], status: "ACTIVE" },
  });

  // Once the fixed role resolves, lock the form to it - the picker for it is
  // never even rendered, so the actor can't submit anything else.
  useEffect(() => {
    if (fixedRole) form.setValue("roleIds", [fixedRole._id]);
  }, [fixedRole, form]);

  async function onSubmit(values: UserCreateInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/users", fixedRole ? { ...values, roleIds: [fixedRole._id] } : values);
      router.push(basePath);
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
        title={fixedRoleSlug ? "Add moderator" : "Add user"}
        description={fixedRoleSlug ? "Create a new moderator account you manage." : "Create a new user account and assign roles."}
        backHref={basePath}
      />
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
        {!fixedRoleSlug && (
          <FormField<UserCreateInput> name="roleIds" label="Roles" required render={(f) => (
            <MultiSelect
              options={roleOptions.map((r) => ({ value: r._id, label: r.name }))}
              value={(f.value as string[]) ?? []}
              onChange={(v) => f.onChange(v)}
            />
          )} />
        )}
        <div className="flex gap-2">
          <SubmitButton loading={form.formState.isSubmitting}>Create user</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.push(basePath)}>Cancel</Button>
        </div>
      </Form>
    </ContentContainer>
  );
}
