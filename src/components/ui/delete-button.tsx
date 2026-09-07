"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";

export type DeleteButtonProps = Omit<ButtonProps, "onClick"> & {
  itemLabel: string;
  onDelete: () => Promise<void> | void;
};

export function DeleteButton({ itemLabel, onDelete, children = "Delete", ...props }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} {...props}>
        <Trash2 className="h-4 w-4" />
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        title={`Delete ${itemLabel}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
