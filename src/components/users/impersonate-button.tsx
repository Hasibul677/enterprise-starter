"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";
import { Alert } from "@/components/feedback/alert";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";

/**
 * "Login as User" (requirement #21). Server-authorized: the click only ever
 * triggers POST /api/auth/impersonate, which independently re-validates
 * Super Admin authority and target eligibility - this component decides
 * nothing, it just renders the confirm step and opens the resulting tab.
 *
 * Popup-blocker note: `window.open()` must run SYNCHRONOUSLY within the
 * "Continue" click handler to count as user-initiated - opening it only
 * after `await`-ing the POST response would get silently blocked by most
 * browsers. So a blank tab is opened FIRST (still inside the click), then
 * its `location` is set once the server confirms and returns where to go;
 * on failure the blank tab is closed instead.
 */
export function ImpersonateButton({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  async function handleConfirm() {
    setError(undefined);
    // No "noopener" here: that flag makes window.open() return null, which
    // would leave us with a blank tab we can never navigate. It's safe to
    // keep the opener reference since we only ever point this tab at our
    // own app's route below, never at an external/untrusted URL.
    const tab = window.open("about:blank", "_blank");
    try {
      const { redirectTo } = await apiClient.post<{ redirectTo: string }>("/api/auth/impersonate", { targetUserId: userId });
      if (tab) tab.location.href = redirectTo;
      else window.open(redirectTo, "_blank"); // popup was blocked before we even had a URL - try once more now
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiClientError ? err.message : "Failed to start impersonation.");
      throw err; // keep the dialog open so the error is visible
    }
  }

  return (
    <>
      <IconButton label="Login as user" onClick={() => setOpen(true)}>
        <LogIn className="h-4 w-4" />
      </IconButton>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(undefined);
        }}
        onConfirm={handleConfirm}
        title={`Login as ${userLabel}?`}
        description={`You are about to access this account as ${userLabel}. All actions will be performed under this user's permissions. This opens in a new tab and is fully logged.`}
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
