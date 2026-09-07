"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/icon-button";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Prevent accidental close while an async submission is in flight. */
  preventClose?: boolean;
  className?: string;
};

/** Shared foundation for every confirmation/form/warning modal in the app. */
export function Dialog({ open, onClose, title, description, children, footer, preventClose, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !preventClose) onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, preventClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40"
            onClick={() => !preventClose && onClose()}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "relative z-10 w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-xl",
              className
            )}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 id="dialog-title" className="text-base font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
              </div>
              {!preventClose && (
                <IconButton label="Close dialog" onClick={onClose}>
                  <X className="h-4 w-4" />
                </IconButton>
              )}
            </div>
            <div>{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
