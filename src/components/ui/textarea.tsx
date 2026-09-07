import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, disabled, ...props },
  ref
) {
  return (
    <textarea
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
