import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function FormLabel({
  className,
  required,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("text-sm font-medium text-ink", className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}
