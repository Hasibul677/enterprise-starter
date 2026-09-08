import { UserCreateView } from "@/components/users/user-create-view";
import { ROLE_SLUGS } from "@/lib/permissions/constants";

export default function NewModeratorPage() {
  return <UserCreateView basePath="/normal-admin/users" fixedRoleSlug={ROLE_SLUGS.MODERATOR} />;
}
