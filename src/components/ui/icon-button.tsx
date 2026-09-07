import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; // mandatory accessible name for icon-only buttons
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft hover:bg-paper hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
