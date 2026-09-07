"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas/register.schema";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setGlobalError(null);
    try {
      // Note: even if a malicious client mutated the request payload to add
      // roles/status/isSuperAdmin, registerSchema strips them before this
      // ever reaches the API - and the server-side registerUser() service
      // ignores anything outside its typed 4-field signature regardless.
      await apiClient.post("/api/auth/register", values);
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiClientError) {
        applyServerErrors(form.setError, err.errors);
        setGlobalError(err.errors?.length ? null : err.message);
      } else {
        setGlobalError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-ink">Create an account</h1>
      <p className="mb-5 text-sm text-ink-soft">New accounts start with viewer-only access.</p>
      {globalError && (
        <div className="mb-4">
          <Alert variant="danger">{globalError}</Alert>
        </div>
      )}
      <Form form={form} onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField<RegisterInput>
            name="firstName"
            label="First name"
            required
            render={(field) => (
              <Input id={field.id} value={field.value as string} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} invalid={field.invalid} />
            )}
          />
          <FormField<RegisterInput>
            name="lastName"
            label="Last name"
            required
            render={(field) => (
              <Input id={field.id} value={field.value as string} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} invalid={field.invalid} />
            )}
          />
        </div>
        <FormField<RegisterInput>
          name="email"
          label="Email"
          required
          render={(field) => (
            <Input id={field.id} type="email" value={field.value as string} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} invalid={field.invalid} autoComplete="email" />
          )}
        />
        <FormField<RegisterInput>
          name="password"
          label="Password"
          required
          description="At least 8 characters with upper, lower, and a digit."
          render={(field) => (
            <PasswordInput id={field.id} value={field.value as string} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} invalid={field.invalid} autoComplete="new-password" />
          )}
        />
        <SubmitButton loading={form.formState.isSubmitting} className="w-full">
          Create account
        </SubmitButton>
      </Form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </>
  );
}
