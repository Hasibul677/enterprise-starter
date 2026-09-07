import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, disabled, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60",
        "border-line transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
        invalid && "border-danger focus:border-danger focus:ring-danger/20",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      {...props}
    />
  );
});
