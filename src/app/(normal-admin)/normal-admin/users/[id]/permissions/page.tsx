import { UserPermissionsView } from "@/components/users/user-permissions-view";
import { CORE_RESOURCES } from "@/lib/permissions/constants";

const RESOURCES = [
  { key: CORE_RESOURCES.USERS, label: "Users" },
  { key: CORE_RESOURCES.COMMENTS, label: "Comments" },
  { key: CORE_RESOURCES.REPORTS, label: "Reports" },
  { key: CORE_RESOURCES.DASHBOARD, label: "Dashboard" },
];

export default function ModeratorPermissionsPage() {
  return <UserPermissionsView basePath="/normal-admin/users" resources={RESOURCES} />;
}
