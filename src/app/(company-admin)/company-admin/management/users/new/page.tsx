import { UserCreateView } from "@/components/users/user-create-view";
import { USER_LAYERS } from "@/lib/permissions/constants";

export default function NewModeratorPage() {
  return (
    <UserCreateView
      basePath="/company-admin/management/users"
      fixedUserLayer={USER_LAYERS.MODERATOR}
      listHref={`/company-admin/management?layer=${USER_LAYERS.MODERATOR}`}
    />
  );
}
