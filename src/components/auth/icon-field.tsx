import { cloneElement, isValidElement, type ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type IconFieldProps = {
  icon: LucideIcon;
  children: ReactElement<{ className?: string }>;
};

/**
 * Adds a leading icon to any Input/PasswordInput without forking those
 * shared components - just injects left padding via className cloning.
 */
export function IconField({ icon: Icon, children }: IconFieldProps) {
  const field = isValidElement(children)
    ? cloneElement(children, { className: cn(children.props.className, "pl-10") })
    : children;

  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60"
      />
      {field}
    </div>
  );
}
