"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/features/auth/schemas/login.schema";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/feedback/alert";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setGlobalError(null);
    try {
      await apiClient.post("/api/auth/login", values);
      const me = await apiClient.get<{
        user: { _id: string; firstName: string; lastName: string; email: string; status: string };
        permissions: ReturnType<typeof Object>;
        isSuperAdmin: boolean;
        menus: never[];
        warning: boolean;
      }>("/api/auth/me");
      setSession(me as never);
      router.push(searchParams.get("redirectTo") || (me.isSuperAdmin ? "/admin" : "/dashboard"));
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
      <h1 className="mb-1 text-lg font-semibold text-ink">Sign in</h1>
      <p className="mb-5 text-sm text-ink-soft">Enter your credentials to access your dashboard.</p>
      {globalError && (
        <div className="mb-4">
          <Alert variant="danger">{globalError}</Alert>
        </div>
      )}
      <Form form={form} onSubmit={onSubmit}>
        <FormField<LoginInput>
          name="email"
          label="Email"
          required
          render={(field) => (
            <Input
              id={field.id}
              type="email"
              value={field.value as string}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              invalid={field.invalid}
              autoComplete="email"
            />
          )}
        />
        <FormField<LoginInput>
          name="password"
          label="Password"
          required
          render={(field) => (
            <PasswordInput
              id={field.id}
              value={field.value as string}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              invalid={field.invalid}
              autoComplete="current-password"
            />
          )}
        />
        <SubmitButton loading={form.formState.isSubmitting} className="w-full">
          Sign in
        </SubmitButton>
      </Form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-accent">
          Register
        </Link>
      </p>
    </>
  );
}

export { LoginForm };
