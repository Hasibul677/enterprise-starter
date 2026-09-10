"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { UserListView } from "@/components/users/user-list-view";
import { LAYER_LABELS } from "@/components/users/user-create-dialog";
import { RoleCreateDialog } from "@/components/management/role-create-dialog";
import { MenuCreateDialog } from "@/components/management/menu-create-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { CREATABLE_ROLE_LAYERS_BY } from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";

const LAYER_ORDER: UserLayer[] = [
  USER_LAYERS.SUPER_ADMIN,
  USER_LAYERS.ADMIN,
  USER_LAYERS.COMPANY_ADMIN,
  USER_LAYERS.MODERATOR,
  USER_LAYERS.CUSTOMER,
];

const USER_SECTION_COPY: Record<
  UserLayer,
  { title: string; description: string; createLabel: string; emptyTitle: string; emptyDescription: string }
> = {
  [USER_LAYERS.SUPER_ADMIN]: {
    title: "Users",
    description: "Super Admin accounts.",
    createLabel: "Add user",
    emptyTitle: "No Super Admin accounts",
    emptyDescription: "Super Admin accounts are provisioned outside this UI.",
  },
  [USER_LAYERS.ADMIN]: {
    title: "Users",
    description: "Admin accounts.",
    createLabel: "Add user",
    emptyTitle: "No admins yet",
    emptyDescription: "Create your first admin account.",
  },
  [USER_LAYERS.COMPANY_ADMIN]: {
    title: "Users",
    description: "Company Admin accounts.",
    createLabel: "Add user",
    emptyTitle: "No company admins yet",
    emptyDescription: "Create your first company admin account.",
  },
  [USER_LAYERS.MODERATOR]: {
    title: "Moderators",
    description: "Moderator accounts you manage.",
    createLabel: "Add moderator",
    emptyTitle: "No moderators yet",
    emptyDescription: "Create your first moderator to get started.",
  },
  [USER_LAYERS.CUSTOMER]: {
    title: "Users",
    description: "Customer accounts.",
    createLabel: "Add user",
    emptyTitle: "No customers yet",
    emptyDescription: "Customers normally self-register - manual creation is also available here.",
  },
};

/**
 * Layer-tabbed management hub. Only the layers the actor is authorized to at
 * least VIEW appear as tabs at all - `visibleLayers` (computed server-side
 * per actor by the two page.tsx wrappers from VIEWABLE_TARGET_LAYERS_BY,
 * role-hierarchy.ts) is a hard allow-list, not a disabled-state hint: a
 * layer the actor has no access to is completely absent from the tab bar,
 * never shown-but-disabled. Super Admin gets every layer, per requirement.
 * E.g. a COMPANY_ADMIN sees only MODERATOR (full manage) and CUSTOMER
 * (view-only - see user-list-view.tsx's per-layer manage gating); it never
 * sees SUPER_ADMIN/ADMIN/COMPANY_ADMIN tabs, disabled or otherwise.
 *
 * The selected tab shows the Users table plus, when the actor is authorized
 * to manage roles/menus for THIS layer, "Add Role"/"Add Menu" toolbar
 * actions - Role/Permissions/Menu Access are otherwise reached from each
 * user row's own kebab menu (see user-list-view.tsx). Everything opens as a
 * modal; this component never navigates to a separate route.
 */
export function ManagementView({
  area,
  visibleLayers,
  initialLayer,
}: {
  area: "admin" | "company-admin";
  visibleLayers: UserLayer[];
  initialLayer?: string;
}) {
  const router = useRouter();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const actorLayer = useAuthStore((s) => s.userLayer);
  const enabledSet = useMemo(() => new Set(visibleLayers), [visibleLayers]);
  const orderedLayers = useMemo(() => LAYER_ORDER.filter((l) => enabledSet.has(l)), [enabledSet]);
  const [layer, setLayer] = useState<UserLayer | undefined>(() => {
    const requested = initialLayer as UserLayer | undefined;
    if (requested && enabledSet.has(requested)) return requested;
    return orderedLayers[0];
  });
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  function selectLayer(next: UserLayer) {
    setLayer(next);
    router.replace(`/${area}/management?layer=${next}`);
  }

  if (!layer) {
    return (
      <ContentContainer>
        <PageHeader title="Management" description="You don't have access to manage any user layer." />
      </ContentContainer>
    );
  }

  const userCopy = USER_SECTION_COPY[layer];
  const actorLayerForChecks = isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : actorLayer;
  // Same authority table role.service.ts#createRole enforces server-side -
  // this only decides whether the button renders at all (e.g. a Super Admin
  // can now also create additional SUPER_ADMIN-layer roles; a plain Admin
  // still can't create roles for any layer).
  const canCreateRoleInLayer = (CREATABLE_ROLE_LAYERS_BY[actorLayerForChecks] ?? []).includes(layer);

  return (
    <ContentContainer>
      <PageHeader title="Management" description="Users, organized by user layer." />
      {orderedLayers.length > 1 && (
        <Tabs
          items={orderedLayers.map((l) => ({ value: l, label: LAYER_LABELS[l] }))}
          value={layer}
          onChange={selectLayer}
        />
      )}
      {(canCreateRoleInLayer || area === "admin") && (
        <div className="mb-4 flex gap-2">
          {canCreateRoleInLayer && (
            <PermissionGuard resource="roles" action="add">
              <Button size="sm" variant="secondary" onClick={() => setCreateRoleOpen(true)}>
                <Plus className="h-4 w-4" /> Add role
              </Button>
            </PermissionGuard>
          )}
          {area === "admin" && (
            <PermissionGuard resource="menus" action="add">
              <Button size="sm" variant="secondary" onClick={() => setCreateMenuOpen(true)}>
                <Plus className="h-4 w-4" /> Add menu
              </Button>
            </PermissionGuard>
          )}
        </div>
      )}
      <UserListView
        userLayer={layer}
        title={userCopy.title}
        description={userCopy.description}
        createLabel={userCopy.createLabel}
        emptyTitle={userCopy.emptyTitle}
        emptyDescription={userCopy.emptyDescription}
      />
      <RoleCreateDialog
        open={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        onSaved={() => setCreateRoleOpen(false)}
        layer={layer}
      />
      <MenuCreateDialog
        open={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onSaved={() => setCreateMenuOpen(false)}
        layer={layer}
      />
    </ContentContainer>
  );
}
