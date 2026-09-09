"use client";

import Link, { type LinkProps } from "next/link";
import { forwardRef, useContext, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { RowActionsMenuContext } from "./row-actions-menu";

const itemBase = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm";
const itemVariant = (variant: "default" | "danger") =>
  variant === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-paper";

export type RowActionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    icon: ReactNode;
    label: string;
  };

/** Navigational row-action item (View, Edit, ...) inside a <RowActionsMenu>. */
export function RowActionLink({ icon, label, className, onClick, ...props }: RowActionLinkProps) {
  const close = useContext(RowActionsMenuContext);
  return (
    <Link
      role="menuitem"
      onClick={(e) => {
        close();
        onClick?.(e);
      }}
      className={cn(itemBase, itemVariant("default"), className)}
      {...props}
    >
      {icon}
      {label}
    </Link>
  );
}

export type RowActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: "default" | "danger";
};

/**
 * Button-style row-action item inside a <RowActionsMenu>. Closes the menu
 * before running its own onClick, so it composes with components like
 * <DeleteButton>/<ImpersonateButton> that open a confirm dialog on click -
 * the dialog opens independently of (and outlives) the menu closing.
 */
export const RowActionButton = forwardRef<HTMLButtonElement, RowActionButtonProps>(function RowActionButton(
  { icon, label, variant = "default", className, onClick, ...props },
  ref
) {
  const close = useContext(RowActionsMenuContext);
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={(e) => {
        close();
        onClick?.(e);
      }}
      className={cn(itemBase, itemVariant(variant), className)}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
});
