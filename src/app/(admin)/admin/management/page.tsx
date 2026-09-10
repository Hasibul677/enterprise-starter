import { requireAdminAreaPage } from "@/lib/auth/route-guards";
import { getVisibleUserManagementLayers } from "@/lib/permissions/role-hierarchy";
import { ManagementView } from "@/components/management/management-view";

export default async function AdminManagementPage({ searchParams }: { searchParams: Promise<{ layer?: string }> }) {
  const access = await requireAdminAreaPage();
  const { layer } = await searchParams;

  const visibleLayers = getVisibleUserManagementLayers(access);

  return <ManagementView area="admin" visibleLayers={visibleLayers} initialLayer={layer} />;
}
