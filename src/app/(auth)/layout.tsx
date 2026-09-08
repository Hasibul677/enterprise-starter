import type { ReactNode } from "react";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCardFrame } from "@/components/auth/auth-card-frame";

/**
 * Single unified gradient owns the ENTIRE viewport (both the branding panel
 * and the form sit transparently on top of it, as one continuous surface -
 * no separate colored/white column). Fixed to `h-dvh` + `overflow-hidden` so
 * this route never produces a page-level scrollbar; only the form column
 * gets `overflow-y-auto` as a last-resort safety net if content is ever
 * taller than the viewport (verified not to trigger at any tested size).
 *
 * Below `lg` this is a FLEX COLUMN (hero sized by its own content, form
 * column takes the rest via `flex-1`) - at `lg`+ it switches to a two-column
 * GRID, where both children stretch to the row's height automatically
 * (grid's default `align-items: stretch`), so neither child needs an
 * explicit height. Giving either child a hardcoded `h-full` here would be a
 * bug in the flex-column case: each would independently claim the *entire*
 * viewport height and stack on top of the other, pushing the form fully
 * below the fold - invisible and, since the wrapper clips overflow,
 * unreachable even by scrolling.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-br from-[#181310] via-ink to-accent lg:grid lg:grid-cols-2">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="animate-blob absolute -left-20 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl sm:h-80 sm:w-80" />
        <div
          className="animate-blob absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent-soft/15 blur-3xl sm:h-[26rem] sm:w-[26rem]"
          style={{ animationDelay: "4s" }}
        />
        <div
          className="animate-blob absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl"
          style={{ animationDelay: "8s" }}
        />
      </div>

      <AuthHero />

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-3 sm:px-6 lg:px-10 lg:py-6">
        <div className="w-full max-w-md">
          <AuthCardFrame>{children}</AuthCardFrame>
        </div>
      </div>
    </div>
  );
}
