import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SelectOption = { value: string; label: string };

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
  invalid?: boolean;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, invalid, placeholder, disabled, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full appearance-none rounded-md border bg-surface px-3 py-2 pr-9 text-sm text-ink",
          "border-line transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          invalid && "border-danger focus:border-danger focus:ring-danger/20",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
    </div>
  );
});
