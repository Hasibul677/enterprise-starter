"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * A brand-new browser tab already carries one ("about:blank") history entry
 * before any real navigation happens, so `window.history.length > 1` is true
 * even for a direct deep-link with nothing real to go back to - clicking
 * Back would then land on a blank page. Track real in-app route changes
 * ourselves instead (sessionStorage: per-tab, cleared when the tab closes).
 */
const HAS_NAVIGATED_KEY = "nav:has-client-navigated";

/**
 * Mount once near the root of the authenticated app (see AuthenticatedShell)
 * so every BackButton on every page can tell "was there a real previous
 * in-app route in this tab" apart from "is this the first page this tab
 * ever rendered".
 */
export function useTrackClientNavigation() {
  const pathname = usePathname();
  // Stores the actual previous pathname (not just a "have we mounted yet?"
  // boolean) so this stays correct under Strict Mode's dev-only double
  // effect invocation: re-running this same effect with an unchanged
  // pathname must never look like a real navigation.
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousPathname.current !== undefined && previousPathname.current !== pathname) {
      try {
        window.sessionStorage.setItem(HAS_NAVIGATED_KEY, "1");
      } catch {
        // sessionStorage can throw in locked-down browser contexts - Back buttons
        // will just fall back to their given route instead of using history.
      }
    }
    previousPathname.current = pathname;
  }, [pathname]);
}

/**
 * Returns to the actual previous route in the browser's session history
 * (router.back()) rather than a hardcoded destination, so e.g. Users ->
 * User Details -> Back lands back on Users, not always on the dashboard.
 * `fallbackHref` only fires when this page was entered directly (no prior
 * in-app navigation this tab has made) - see requirement in the nav spec.
 */
export function BackButton({
  fallbackHref,
  label = "Back",
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    let navigated = false;
    try {
      navigated = window.sessionStorage.getItem(HAS_NAVIGATED_KEY) === "1";
    } catch {
      // Default to false (use the fallback route) if sessionStorage is unavailable.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API (sessionStorage) to decide back-nav behavior, not a render-time state sync
    setHasHistory(navigated);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => (hasHistory ? router.back() : router.push(fallbackHref))}
      className={cn("gap-1.5 px-2 text-ink-soft hover:text-ink", className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
