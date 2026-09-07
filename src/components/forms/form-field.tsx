"use client";

import { useFormContext, Controller, type FieldValues, type FieldPath } from "react-hook-form";
import type { ReactElement } from "react";
import { FormLabel } from "./form-label";
import { FormMessage } from "./form-message";
import { FormDescription } from "./form-description";

export type FormFieldProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  required?: boolean;
  /** Render-prop so any input (Input/Select/PasswordInput/MultiSelect/custom) can be used uniformly. */
  render: (field: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    invalid: boolean;
    id: string;
  }) => ReactElement;
};

/**
 * Uses Controller so this same wrapper works for both native inputs
 * (register-style) and fully controlled components (MultiSelect, Switch,
 * DatePicker) without any per-field boilerplate at call sites.
 */
export function FormField<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  render,
}: FormFieldProps<TFieldValues>) {
  const {
    control,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  const error = errors[name as keyof typeof errors];
  const errorMessage = typeof error?.message === "string" ? error.message : undefined;
  const fieldId = `field-${String(name)}`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <FormLabel htmlFor={fieldId} required={required}>
          {label}
        </FormLabel>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) =>
          render({
            value: field.value,
            onChange: field.onChange,
            onBlur: field.onBlur,
            invalid: Boolean(errorMessage),
            id: fieldId,
          })
        }
      />
      {description && !errorMessage && <FormDescription>{description}</FormDescription>}
      <FormMessage>{errorMessage}</FormMessage>
    </div>
  );
}
