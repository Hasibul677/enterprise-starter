"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { IconButton, type IconButtonProps } from "./icon-button";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";
import { cn } from "@/lib/utils/cn";

export type DeleteButtonProps = Omit<IconButtonProps, "onClick" | "label" | "children"> & {
  itemLabel: string;
  /** Tooltip text + confirm-dialog verb - e.g. "Deactivate" instead of the default "Delete". */
  actionLabel?: string;
  onDelete: () => Promise<void> | void;
  /** Custom trigger (e.g. a <RowActionButton> inside a <RowActionsMenu>) instead of the default icon-only button. */
  renderTrigger?: (onClick: () => void) => ReactNode;
};

/** Icon-only, tooltip-labeled destructive action - hover shows `actionLabel` (e.g. "Deactivate"). */
export function DeleteButton({ itemLabel, actionLabel = "Delete", onDelete, renderTrigger, className, ...props }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <IconButton
          label={actionLabel}
          onClick={() => setOpen(true)}
          className={cn("hover:bg-danger-soft hover:text-danger", className)}
          {...props}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        title={`${actionLabel} ${itemLabel}?`}
        description="This cannot be undone."
        confirmLabel={actionLabel}
      />
    </>
  );
}
