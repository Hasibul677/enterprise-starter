import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type IconLinkProps = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  label: string; // mandatory accessible name + hover tooltip for icon-only links
};

/** Icon-only navigation counterpart to <IconButton> - same size/tooltip/focus treatment, for row actions that navigate (View, Edit, ...). */
export function IconLink({ className, label, children, ...props }: IconLinkProps) {
  return (
    <Link
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
    </Link>
  );
}
