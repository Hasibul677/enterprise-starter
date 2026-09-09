"use client";

import { useState, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";
import { Alert } from "@/components/feedback/alert";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

/**
 * "Login as User" (requirement #21). Server-authorized: the click only ever
 * triggers POST /api/auth/impersonate, which independently re-validates
 * Super Admin authority and target eligibility - this component decides
 * nothing, it just renders the confirm step and navigates to the result.
 *
 * Same-tab, hard navigation (not router.push): mirrors exactly what the
 * "Return to Super Admin" button does in authenticated-shell.tsx, and for
 * the same reason - a full reload guarantees every client-side auth/menu/
 * permission cache (the Zustand store) is rebuilt from scratch for the
 * target's session, with nothing left over from the Super Admin session
 * that started it.
 */
export function ImpersonateButton({
  userId,
  userLabel,
  renderTrigger,
}: {
  userId: string;
  userLabel: string;
  /** Custom trigger (e.g. a <RowActionButton> inside a <RowActionsMenu>) instead of the default icon-only button. */
  renderTrigger?: (onClick: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  async function handleConfirm() {
    setError(undefined);
    try {
      const { redirectTo } = await apiClient.post<{ redirectTo: string }>("/api/auth/impersonate", { targetUserId: userId });
      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to start impersonation.");
      throw err; // keep the dialog open so the error is visible
    }
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <IconButton label="Login as user" onClick={() => setOpen(true)}>
          <LogIn className="h-4 w-4" />
        </IconButton>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(undefined);
        }}
        onConfirm={handleConfirm}
        title={`Login as ${userLabel}?`}
        description={`You are about to access this account as ${userLabel}. All actions will be performed under this user's permissions. This is fully logged.`}
        confirmLabel="Continue"
      >
        {error && (
          <div className="mt-3">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
