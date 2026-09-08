"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Glass-soft card chrome shared by the sign-in and register screens. It's
 * intentionally a near-opaque LIGHT glass (not a solid opaque panel, not a
 * dark one) sitting on top of AuthLayout's shared gradient: translucent +
 * blurred enough to read as "glass" against the gradient bleeding through at
 * its edges, but opaque enough (90%) that every existing ink-on-light text
 * color in the app (headings, labels, inputs, errors) keeps its normal,
 * already-correct contrast with zero changes needed to those components.
 */
export function AuthCardFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-3xl border border-white/40 bg-surface/90 p-4 shadow-2xl backdrop-blur-2xl sm:p-7"
    >
      {children}
    </motion.div>
  );
}
