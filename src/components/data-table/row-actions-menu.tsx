"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

export const RowActionsMenuContext = createContext<() => void>(() => {});

/**
 * Kebab menu replacing a row of bare icon buttons in a table's Actions
 * column. The panel is rendered through a portal, fixed-positioned from the
 * trigger's own rect, because DataTable's rounded wrapper and horizontal-
 * scroll container both clip an absolutely-positioned panel - same
 * constraint as the collapsed-sidebar flyout in sidebar-menu-item.tsx.
 */
export function RowActionsMenu({ children, label = "Actions" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  // Once opened, the panel stays mounted (just hidden) instead of being torn
  // down - an item like <DeleteButton> keeps its own <ConfirmDialog> inside
  // this subtree, and closing the menu on click must not unmount that dialog
  // before its `open` state gets a chance to render it.
  const [everOpened, setEverOpened] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setEverOpened(true);
    setOpen(true);
  }

  // Re-measure once the panel is actually in the DOM: if it doesn't fit
  // below the trigger within the viewport, flip it to open upward instead
  // of letting it run off-screen. Runs before paint so there's no flicker.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const fitsBelow = triggerRect.bottom + 4 + panelRect.height + 8 <= window.innerHeight;
    setPos({
      top: fitsBelow ? triggerRect.bottom + 4 : undefined,
      bottom: fitsBelow ? undefined : window.innerHeight - triggerRect.top + 4,
      right: window.innerWidth - triggerRect.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <>
      <IconButton ref={triggerRef} label={label} onClick={() => (open ? close() : openMenu())}>
        <MoreVertical className="h-4 w-4" />
      </IconButton>
      {everOpened &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            hidden={!open}
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="fixed z-50 w-48 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
          >
            <RowActionsMenuContext.Provider value={close}>{children}</RowActionsMenuContext.Provider>
          </div>,
          document.body
        )}
    </>
  );
}
