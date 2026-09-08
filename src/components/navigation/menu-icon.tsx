import type { IconType } from "react-icons";
import { FiLayers, FiList, FiFileText } from "react-icons/fi";
import { cn } from "@/lib/utils/cn";

/**
 * One consistent icon + size per menu depth (Main / Sub / Sub-Sub), NOT per
 * item - this is what makes the 3-level hierarchy visually obvious at a
 * glance, rather than encoding per-item meaning. A depth beyond level 3
 * (shouldn't happen - MAX_MENU_DEPTH is 3) reuses the deepest level's style.
 */
const LEVEL_ICONS: readonly IconType[] = [FiLayers, FiList, FiFileText];
const LEVEL_SIZES: readonly number[] = [20, 18, 16];

export function MenuIcon({ depth, className }: { depth: number; className?: string }) {
  const level = Math.min(depth, LEVEL_ICONS.length - 1);
  const Icon = LEVEL_ICONS[level];
  return (
    <Icon aria-hidden="true" size={LEVEL_SIZES[level]} className={cn("shrink-0", className)} />
  );
}
