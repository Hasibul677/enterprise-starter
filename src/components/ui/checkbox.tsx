import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref
) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-ink">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn("h-4 w-4 rounded border-line accent-accent", className)}
        {...props}
      />
      {label}
    </label>
  );
});
