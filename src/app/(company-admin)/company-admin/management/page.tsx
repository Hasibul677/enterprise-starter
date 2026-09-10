import { requireCompanyAdminAreaPage } from "@/lib/auth/route-guards";
import { VIEWABLE_TARGET_LAYERS_BY } from "@/lib/permissions/role-hierarchy";
import { USER_LAYER_VALUES } from "@/lib/permissions/constants";
import { ManagementView } from "@/components/management/management-view";

export default async function CompanyAdminManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ layer?: string }>;
}) {
  const access = await requireCompanyAdminAreaPage();
  const { layer } = await searchParams;

  const visibleLayers = access.isSuperAdmin ? USER_LAYER_VALUES : (VIEWABLE_TARGET_LAYERS_BY[access.userLayer] ?? []);

  return <ManagementView area="company-admin" visibleLayers={visibleLayers} initialLayer={layer} />;
}
