"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - nothing to do,
      // and nothing sensitive gets logged either way.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper/60 px-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">{label}</div>
        <div className="truncate font-mono text-sm text-ink">{value}</div>
      </div>
      <IconButton label={`Copy demo ${label.toLowerCase()}`} type="button" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </IconButton>
    </div>
  );
}

/**
 * `email`/`password` are passed in from login/page.tsx (a Server Component
 * that reads NEXT_PUBLIC_DEMO_EMAIL/PASSWORD server-side) rather than read
 * here via `process.env.NEXT_PUBLIC_*` directly - see the comment on those
 * vars in src/config/env.ts for why: Next's build-time inlining of that
 * exact syntax in a "use client" file corrupts values containing "$"
 * followed by digits. Both undefined/empty means this returns null and the
 * rest of the login page is unaffected.
 */
export function DemoAccountPanel({
  email,
  password,
  onUseDemoAccount,
}: {
  email?: string;
  password?: string;
  onUseDemoAccount: (email: string, password: string) => void;
}) {
  if (!email || !password) return null;

  return (
    <div className="mb-4 rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Demo account</p>
      <div className="flex flex-col gap-1.5">
        <CopyField label="Email" value={email} />
        <CopyField label="Password" value={password} />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        onClick={() => onUseDemoAccount(email, password)}
      >
        Use demo account
      </Button>
    </div>
  );
}
