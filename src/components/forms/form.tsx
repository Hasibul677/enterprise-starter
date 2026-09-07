"use client";

import { FormProvider, type UseFormReturn, type FieldValues } from "react-hook-form";
import type { ReactNode, FormHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type FormProps<TFieldValues extends FieldValues> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => void | Promise<void>;
  children: ReactNode;
};

/**
 * Standard wrapper: FormProvider + native <form onSubmit={form.handleSubmit(...)}>.
 * Every feature form (user-create, role-create, menu-create, ...) composes
 * this instead of re-wiring RHF plumbing per page.
 */
export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex flex-col gap-4", className)}
        noValidate
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}
