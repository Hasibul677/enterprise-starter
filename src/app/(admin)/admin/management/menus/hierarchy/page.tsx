"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { apiClient } from "@/lib/api-client/api-client";
import { cn } from "@/lib/utils/cn";

type MenuNode = {
  _id: string;
  name: string;
  route?: string | null;
  isActive: boolean;
  isVisible: boolean;
  parentId: string | null;
  sortOrder: number;
  children: MenuNode[];
};

type FlatMenu = {
  _id: string;
  name: string;
  route?: string | null;
  isActive: boolean;
  isVisible: boolean;
  parentId: string | null;
  sortOrder: number;
};

/**
 * Admin-facing hierarchy view (requirement #69: "Hierarchy Management",
 * listed separately from the flat Menu List/Create/Edit pages). Unlike the
 * effective-menu-tree the Sidebar renders, this shows EVERY menu item -
 * including inactive/hidden ones - so an admin can see and manage the full
 * 3-level structure. Reparenting itself still happens on the Edit page
 * (via the parent dropdown), which independently re-validates depth/cycles
 * server-side regardless of what this read-only view displays.
 */
function buildAdminTree(flat: FlatMenu[]): MenuNode[] {
  const byParent = new Map<string, FlatMenu[]>();
  for (const m of flat) {
    const key = m.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(m);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  function build(parentKey: string): MenuNode[] {
    return (byParent.get(parentKey) ?? []).map((m) => ({ ...m, children: build(m._id) }));
  }

  return build("root");
}

function TreeRow({ node, depth = 0 }: { node: MenuNode; depth?: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-line py-2 last:border-0"
        style={{ paddingLeft: depth * 20 }}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-ink-soft/40" />
        <Link href={`/admin/management/menus/${node._id}/edit`} className="text-sm font-medium text-ink hover:text-accent">
          {node.name}
        </Link>
        {node.route && <span className="text-xs text-ink-soft">{node.route}</span>}
        <span className="ml-auto flex gap-1.5">
          {!node.isActive && (
            <span className="rounded-full bg-line px-2 py-0.5 text-xs text-ink-soft">Inactive</span>
          )}
          {!node.isVisible && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">Hidden</span>
          )}
        </span>
      </div>
      {node.children.map((child) => (
        <TreeRow key={child._id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function MenuHierarchyPage() {
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const flat = await apiClient.get<FlatMenu[]>("/api/menus");
      setTree(buildAdminTree(flat));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu hierarchy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  return (
    <ContentContainer>
      <PageHeader
        title="Menu hierarchy"
        description="Full 3-level structure, including inactive and hidden items. Click an item to edit it, including reparenting."
        backHref="/admin/management"
      />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <div className={cn("rounded-lg border border-line bg-surface p-2")}>
          {tree.length === 0 ? (
            <p className="p-4 text-sm text-ink-soft">No menu items yet.</p>
          ) : (
            tree.map((node) => <TreeRow key={node._id} node={node} />)
          )}
        </div>
      )}
    </ContentContainer>
  );
}
