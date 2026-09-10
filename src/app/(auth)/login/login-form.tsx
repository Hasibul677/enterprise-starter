"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@/features/auth/schemas/login.schema";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/feedback/alert";
import { IconField } from "@/components/auth/icon-field";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { resolvePostLoginRedirect } from "@/lib/permissions/role-hierarchy";
import type { UserLayer } from "@/lib/permissions/constants";

const fieldClassName = "h-10 rounded-xl bg-paper/50 transition-all duration-200 focus:bg-surface focus:ring-4";

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
        userLayer: UserLayer;
        roleSlugs: string[];
        menus: never[];
        warning: boolean;
      }>("/api/auth/me");
      setSession(me as never);
      router.push(resolvePostLoginRedirect(searchParams.get("redirectTo"), me));
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
      <div className="mb-4">
        <span className="mb-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Welcome back
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Sign in to your account</h1>
        <p className="mt-1 text-sm text-ink-soft">Enter your credentials to access your dashboard.</p>
      </div>

      <AnimatePresence initial={false}>
        {globalError && (
          <motion.div
            key={globalError}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Alert variant="danger" className="animate-shake">
              {globalError}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Form form={form} onSubmit={onSubmit} className="gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <FormField<LoginInput>
            name="email"
            label="Email"
            required
            render={(field) => (
              <IconField icon={Mail}>
                <Input
                  id={field.id}
                  type="email"
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  invalid={field.invalid}
                  autoComplete="email"
                  className={fieldClassName}
                />
              </IconField>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <FormField<LoginInput>
            name="password"
            label="Password"
            required
            render={(field) => (
              <IconField icon={Lock}>
                <PasswordInput
                  id={field.id}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  invalid={field.invalid}
                  autoComplete="current-password"
                  className={fieldClassName}
                />
              </IconField>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <SubmitButton
            loading={form.formState.isSubmitting}
            className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-accent/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 active:translate-y-0 active:shadow-md"
          >
            <span className="inline-flex items-center gap-2">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          </SubmitButton>
        </motion.div>
      </Form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-accent transition-colors hover:text-ink">
          Create one
        </Link>
      </p>
    </>
  );
}

export { LoginForm };
