"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { UserListView } from "@/components/users/user-list-view";
import { RolesSection, type RoleRow } from "@/components/management/roles-section";
import { MenusSection } from "@/components/management/menus-section";
import { LAYER_LABELS } from "@/components/users/user-create-view";
import { SCOPE_RESOURCES } from "@/lib/permissions/role-hierarchy";
import { CORE_RESOURCES, USER_LAYERS, type UserLayer } from "@/lib/permissions/constants";

/**
 * Resources relevant to each layer's Menu/Permission rollup - reuses the
 * same SCOPE_RESOURCES role-hierarchy.ts already uses for menu-visibility/
 * grant validation (SUPER_ADMIN and ADMIN share one list, COMPANY_ADMIN and
 * MODERATOR share another, matching the 2-value Menu.scope model). CUSTOMER
 * isn't a menu scope at all, so it gets its own small, explicit list.
 */
const RESOURCES_BY_LAYER: Record<UserLayer, readonly string[]> = {
  [USER_LAYERS.SUPER_ADMIN]: SCOPE_RESOURCES.SUPER_ADMIN_ADMIN,
  [USER_LAYERS.ADMIN]: SCOPE_RESOURCES.SUPER_ADMIN_ADMIN,
  [USER_LAYERS.COMPANY_ADMIN]: SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR,
  [USER_LAYERS.MODERATOR]: SCOPE_RESOURCES.COMPANY_ADMIN_MODERATOR,
  [USER_LAYERS.CUSTOMER]: [CORE_RESOURCES.DASHBOARD],
};

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
 * Layer-tabbed management hub: Users, Roles, and (admin-side only) Menus &
 * Permissions, all scoped to whichever of the 5 fixed user layers is
 * selected. Mounted at both /admin/management (SUPER_ADMIN, ADMIN) and
 * /company-admin/management (COMPANY_ADMIN, MODERATOR) - `visibleLayers` is
 * computed server-side per actor (see the two page.tsx wrappers) using the
 * exact same MANAGEABLE_TARGET_LAYERS_BY authority table every other
 * user-management check in this app already uses, so this component never
 * makes its own authorization decisions - it only decides what to render.
 */
export function ManagementView({
  area,
  basePath,
  visibleLayers,
  initialLayer,
}: {
  area: "admin" | "company-admin";
  basePath: string;
  visibleLayers: UserLayer[];
  initialLayer?: string;
}) {
  const router = useRouter();
  const orderedLayers = useMemo(() => LAYER_ORDER.filter((l) => visibleLayers.includes(l)), [visibleLayers]);
  const [layer, setLayer] = useState<UserLayer>(() =>
    (initialLayer && orderedLayers.includes(initialLayer as UserLayer) ? (initialLayer as UserLayer) : orderedLayers[0]) as UserLayer
  );
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);

  function selectLayer(next: UserLayer) {
    setLayer(next);
    router.replace(`${basePath}?layer=${next}`);
  }

  const rolesForLayer = useMemo(() => allRoles.filter((r) => r.userLayer === layer), [allRoles, layer]);
  const resourcesForLayer = useMemo(
    () => RESOURCES_BY_LAYER[layer].map((key) => ({ key, label: key.replace(/_/g, " ") })),
    [layer]
  );

  if (orderedLayers.length === 0) {
    return (
      <ContentContainer>
        <PageHeader title="Management" description="You don't have access to manage any user layer." />
      </ContentContainer>
    );
  }

  const userCopy = USER_SECTION_COPY[layer];

  return (
    <ContentContainer>
      <PageHeader
        title="Management"
        description="Users, roles, and menus, organized by user layer."
      />
      {orderedLayers.length > 1 && (
        <Tabs items={orderedLayers.map((l) => ({ value: l, label: LAYER_LABELS[l] }))} value={layer} onChange={selectLayer} />
      )}
      <UserListView
        basePath={`${basePath}/users`}
        userLayer={layer}
        title={userCopy.title}
        description={userCopy.description}
        createLabel={userCopy.createLabel}
        emptyTitle={userCopy.emptyTitle}
        emptyDescription={userCopy.emptyDescription}
      />
      <RolesSection layer={layer} basePath={`${basePath}/roles`} area={area} onRolesLoaded={setAllRoles} />
      {area === "admin" && (
        <MenusSection layer={layer} basePath={`${basePath}/menus`} roles={rolesForLayer} resources={resourcesForLayer} />
      )}
    </ContentContainer>
  );
}
