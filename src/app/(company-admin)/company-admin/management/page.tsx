import { requireCompanyAdminAreaPage } from "@/lib/auth/route-guards";
import { getVisibleUserManagementLayers } from "@/lib/permissions/role-hierarchy";
import { ManagementView } from "@/components/management/management-view";

export default async function CompanyAdminManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ layer?: string }>;
}) {
  const access = await requireCompanyAdminAreaPage();
  const { layer } = await searchParams;

  const visibleLayers = getVisibleUserManagementLayers(access);

  return <ManagementView area="company-admin" visibleLayers={visibleLayers} initialLayer={layer} />;
}
