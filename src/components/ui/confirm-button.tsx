"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "./button";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";

export type ConfirmButtonProps = Omit<ButtonProps, "onClick"> & {
  confirmTitle: string;
  confirmDescription?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmButton({ confirmTitle, confirmDescription, confirmLabel = "Confirm", onConfirm, children, ...props }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title={confirmTitle}
        description={confirmDescription}
        variant="primary"
        confirmLabel={confirmLabel}
      />
    </>
  );
}
