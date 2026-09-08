"use client";

import { motion } from "motion/react";
import { History, ShieldCheck, Sparkles, Users } from "lucide-react";

const FEATURES = [
  { icon: ShieldCheck, text: "Hardened sessions with automatic refresh-token rotation" },
  { icon: Users, text: "Fine-grained roles & permissions, enforced server-side on every request" },
  { icon: History, text: "Every sensitive action lands in a tamper-evident audit log" },
];

/**
 * Branding/trust panel. Purely presentational and transparent - it sits on
 * the single shared gradient owned by AuthLayout so the background stays
 * unbroken behind both this panel and the form column.
 *
 * The tagline/features/trust line use the `.auth-tagline` / `.auth-features`
 * / `.auth-trust` utility classes (globals.css) instead of plain `hidden
 * sm:block` - they gate on BOTH width and height together, since a wide-but-
 * short viewport (e.g. a landscape phone) needs the same compact treatment
 * as a narrow one to guarantee the no-scroll requirement.
 */
export function AuthHero() {
  return (
    <div className="relative z-10 flex min-h-0 flex-none flex-col justify-center overflow-hidden px-5 py-3 text-white sm:px-8 lg:h-full lg:justify-between lg:px-14 lg:py-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="auth-topbar flex items-center gap-2.5"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur sm:h-9 sm:w-9 lg:h-10 lg:w-10">
          <Sparkles className="h-4 w-4 text-white sm:h-5 sm:w-5" />
        </span>
        <span className="text-base font-semibold tracking-tight sm:text-lg">Enterprise Starter</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="auth-tagline mt-4 max-w-md lg:mt-0"
      >
        <h1 className="text-2xl font-semibold leading-tight tracking-tight lg:text-4xl">
          One secure login.
          <br /> Full control across every team.
        </h1>
        <p className="mt-3 max-w-sm text-sm text-white/70 lg:text-base">
          A production-grade authentication foundation, built for teams who can&apos;t afford to get access control
          wrong.
        </p>

        <ul className="auth-features mt-8 gap-4">
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <motion.li
              key={text}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="flex items-start gap-3 text-sm text-white/80"
            >
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/10">
                <Icon className="h-3.5 w-3.5 text-white" />
              </span>
              {text}
            </motion.li>
          ))}
        </ul>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="auth-trust mt-10 text-xs text-white/50"
      >
        Trusted, auditable access control, from day one.
      </motion.p>
    </div>
  );
}
