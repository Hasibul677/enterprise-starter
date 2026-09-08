"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas/register.schema";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/feedback/alert";
import { IconField } from "@/components/auth/icon-field";
import { applyServerErrors } from "@/components/forms/set-server-errors";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

const fieldClassName = "h-10 rounded-xl bg-paper/50 transition-all duration-200 focus:bg-surface focus:ring-4";

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
      <div className="mb-2">
        <span className="mb-1 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Get started
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Create your account</h1>
        <p className="mt-1 text-sm text-ink-soft">New accounts start with viewer-only access.</p>
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

      <Form form={form} onSubmit={onSubmit} className="gap-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <FormField<RegisterInput>
            name="firstName"
            label="First name"
            required
            render={(field) => (
              <IconField icon={User}>
                <Input
                  id={field.id}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  invalid={field.invalid}
                  className={fieldClassName}
                />
              </IconField>
            )}
          />
          <FormField<RegisterInput>
            name="lastName"
            label="Last name"
            required
            render={(field) => (
              <IconField icon={User}>
                <Input
                  id={field.id}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  invalid={field.invalid}
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
          <FormField<RegisterInput>
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
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <FormField<RegisterInput>
            name="password"
            label="Password"
            required
            description="At least 8 characters with upper, lower, and a digit."
            render={(field) => (
              <IconField icon={Lock}>
                <PasswordInput
                  id={field.id}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  invalid={field.invalid}
                  autoComplete="new-password"
                  className={fieldClassName}
                />
              </IconField>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <SubmitButton
            loading={form.formState.isSubmitting}
            className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-accent/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 active:translate-y-0 active:shadow-md"
          >
            <span className="inline-flex items-center gap-2">
              Create account
              <ArrowRight className="h-4 w-4" />
            </span>
          </SubmitButton>
        </motion.div>
      </Form>

      <p className="mt-3 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent transition-colors hover:text-ink">
          Sign in
        </Link>
      </p>
    </>
  );
}
