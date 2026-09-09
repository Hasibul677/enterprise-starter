import { UserDetailView } from "@/components/users/user-detail-view";
import { USER_LAYERS } from "@/lib/permissions/constants";

export default function ModeratorDetailsPage() {
  return (
    <UserDetailView
      basePath="/company-admin/management/users"
      backLabel="Back to moderators"
      listHref={`/company-admin/management?layer=${USER_LAYERS.MODERATOR}`}
    />
  );
}
