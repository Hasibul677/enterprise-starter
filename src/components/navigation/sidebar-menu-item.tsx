"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import type { MenuTreeNode } from "@/stores/auth-store";

export function SidebarMenuItem({ node, depth = 0 }: { node: MenuTreeNode; depth?: number }) {
  const pathname = usePathname();
  const isActive = node.route ? pathname === node.route : false;
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(true);

  const content = (
    <span className={cn("flex flex-1 items-center justify-between gap-2 truncate")}>
      <span className="truncate">{node.label}</span>
      {hasChildren && (
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
        />
      )}
    </span>
  );

  const rowClasses = cn(
    "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
    isActive ? "bg-accent-soft font-medium text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"
  );

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      {node.route ? (
        <Link href={node.route} className={rowClasses}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={() => setExpanded((e) => !e)} className={cn(rowClasses, "w-full text-left")}>
          {content}
        </button>
      )}
      {hasChildren && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-0.5 flex flex-col gap-0.5 overflow-hidden"
            >
              {node.children.map((child) => (
                <SidebarMenuItem key={child._id} node={child} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
