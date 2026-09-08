"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiChevronRight } from "react-icons/fi";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import type { MenuTreeNode } from "@/stores/auth-store";
import { MenuIcon } from "./menu-icon";

function isRouteActive(pathname: string, route?: string | null): boolean {
  if (!route) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Does this node or any descendant match the current route? Used to keep a
 * collapsed group's icon visibly "active" even while its children are hidden. */
function containsActiveRoute(node: MenuTreeNode, pathname: string): boolean {
  if (isRouteActive(pathname, node.route)) return true;
  return node.children.some((child) => containsActiveRoute(child, pathname));
}

const rowBase =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

function rowClasses(isActive: boolean) {
  return cn(
    rowBase,
    isActive
      ? "bg-accent-soft text-accent"
      : "text-ink-soft hover:bg-paper hover:text-ink active:bg-accent-soft/70"
  );
}

/**
 * One consistent font weight per depth - Main Menu slightly bold, Sub Menu
 * medium, Sub-Sub Menu regular - so the hierarchy reads clearly through
 * typography alone, on top of (not instead of) the active/hover color and
 * background treatment above.
 */
const LEVEL_LABEL_WEIGHT = ["font-semibold", "font-medium", "font-normal"] as const;

function labelWeightClass(depth: number) {
  return LEVEL_LABEL_WEIGHT[Math.min(depth, LEVEL_LABEL_WEIGHT.length - 1)];
}

/**
 * Renders one level of sibling menu nodes as an accordion: opening one
 * sibling's children automatically closes whichever sibling was open before
 * it, at every level (root menus and every nested sub-menu alike) - each
 * sibling group owns exactly one "which child is expanded" slot rather than
 * each item tracking its own independent open/closed flag.
 *
 * Defaults to whichever sibling's subtree contains the current route, so
 * landing on a nested page doesn't hide its own ancestor chain.
 */
export function SidebarMenuList({
  nodes,
  depth = 0,
  collapsed = false,
}: {
  nodes: MenuTreeNode[];
  depth?: number;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const activeSibling = nodes.find((n) => containsActiveRoute(n, pathname));
    return activeSibling?._id ?? null;
  });

  return (
    <>
      {nodes.map((node) => (
        <SidebarMenuItem
          key={node._id}
          node={node}
          depth={depth}
          collapsed={collapsed}
          expanded={expandedId === node._id}
          onToggleExpanded={() =>
            setExpandedId((prev) => (prev === node._id ? null : node._id))
          }
          onSelect={() => setExpandedId(node._id)}
        />
      ))}
    </>
  );
}

/**
 * A single sidebar/mobile-nav row. Whether ITS OWN children are shown is
 * controlled by the parent `SidebarMenuList` (via `expanded` /
 * `onToggleExpanded`) so siblings can enforce accordion behavior; this
 * component in turn renders its own children through another
 * `SidebarMenuList`, so the same accordion rule applies recursively at every
 * depth. A leaf (route, no children) has nothing to toggle, so it reports
 * itself as "selected" via `onSelect` instead - that's what closes an
 * open sibling GROUP when you navigate to a plain sibling link rather than
 * open another group. `collapsed` (icon-only sidebar) only changes
 * rendering at depth 0 - a collapsed group with children shows a hover/focus
 * flyout instead of an inline accordion, so nested pages (e.g. Roles, User
 * List) stay reachable without needing the sidebar expanded first.
 */
function SidebarMenuItem({
  node,
  depth,
  collapsed,
  expanded,
  onToggleExpanded,
  onSelect,
}: {
  node: MenuTreeNode;
  depth: number;
  collapsed: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelect: () => void;
}) {
  const pathname = usePathname();
  const isActive = isRouteActive(pathname, node.route);
  const hasChildren = node.children.length > 0;
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const isCollapsedRoot = collapsed && depth === 0;
  // A parent with no route of its own (a pure group header) still needs to
  // read as "active" whenever one of its descendants is the current route -
  // in both the expanded accordion and the collapsed flyout trigger.
  const groupIsActive = !node.route && containsActiveRoute(node, pathname);

  function openFlyout() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setFlyoutPos({ top: rect.top, left: rect.right + 6 });
    setFlyoutOpen(true);
  }
  function closeFlyout() {
    setFlyoutOpen(false);
  }

  const content = (
    <span className="flex flex-1 items-center gap-2.5 truncate">
      <MenuIcon depth={depth} />
      {!isCollapsedRoot && (
        <span className="flex flex-1 items-center justify-between gap-2 truncate">
          <span className={cn("truncate", labelWeightClass(depth))}>{node.label}</span>
          {hasChildren && (
            <FiChevronRight
              aria-hidden="true"
              size={14}
              className={cn("shrink-0 transition-transform", expanded && "rotate-90")}
            />
          )}
        </span>
      )}
    </span>
  );

  const row = node.route ? (
    <Link
      href={node.route}
      title={isCollapsedRoot ? node.label : undefined}
      aria-current={isActive ? "page" : undefined}
      // A leaf link has no expand/collapse state of its own, but it still
      // needs to claim this level's single "expanded" slot on click -
      // otherwise a sibling GROUP that's currently open (e.g. "Users") would
      // stay open forever once you navigate to a plain sibling link (e.g.
      // "Roles") instead of toggling another group.
      onClick={onSelect}
      className={cn(rowClasses(isActive), isCollapsedRoot && "justify-center px-0")}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      title={isCollapsedRoot ? node.label : undefined}
      onClick={() => !isCollapsedRoot && onToggleExpanded()}
      className={cn(
        rowClasses(groupIsActive),
        "w-full text-left",
        isCollapsedRoot && "cursor-default justify-center px-0"
      )}
    >
      {content}
    </button>
  );

  // Depth 0, collapsed, with children: icon triggers a floating panel (on
  // hover or keyboard focus) listing the children in their normal, labeled
  // form - the sidebar's own accordion state is untouched underneath it.
  // Rendered through a portal (fixed-positioned from the trigger's own
  // rect) rather than absolutely inside the sidebar: the sidebar's nav is a
  // scroll container (overflow-y-auto), and per the CSS overflow spec a
  // "visible" value on the other axis of a scroll container computes to
  // "auto" instead - i.e. it clips - so an absolutely-positioned panel here
  // would always get cut off at the sidebar's edge no matter what overflow
  // utility this element itself has.
  if (isCollapsedRoot && hasChildren) {
    return (
      <div
        ref={triggerRef}
        onMouseEnter={openFlyout}
        onMouseLeave={closeFlyout}
        onFocus={openFlyout}
        onBlur={closeFlyout}
      >
        {row}
        {flyoutOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              onMouseEnter={openFlyout}
              onMouseLeave={closeFlyout}
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
              className="fixed z-50 min-w-48 rounded-md border border-line bg-surface p-1.5 shadow-lg"
            >
              <p className="truncate px-2 py-1 text-xs font-semibold text-ink-soft">{node.label}</p>
              <div className="flex flex-col gap-0.5">
                <SidebarMenuList nodes={node.children} depth={1} collapsed={false} />
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: isCollapsedRoot ? 0 : depth * 12 }}>
      {row}
      {hasChildren && !isCollapsedRoot && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-0.5 flex flex-col gap-0.5 overflow-hidden"
            >
              <SidebarMenuList nodes={node.children} depth={depth + 1} collapsed={false} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
