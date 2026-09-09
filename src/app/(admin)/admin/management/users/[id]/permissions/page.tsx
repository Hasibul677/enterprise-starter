import { UserPermissionsView } from "@/components/users/user-permissions-view";
import { CORE_RESOURCES } from "@/lib/permissions/constants";

const RESOURCES = [
  { key: CORE_RESOURCES.USERS, label: "Users" },
  { key: CORE_RESOURCES.ROLES, label: "Roles" },
  { key: CORE_RESOURCES.MENUS, label: "Menus" },
  { key: CORE_RESOURCES.AUDIT_LOG, label: "Audit Log" },
  { key: CORE_RESOURCES.PERMISSIONS, label: "Permissions" },
  { key: CORE_RESOURCES.SETTINGS, label: "Settings" },
  { key: CORE_RESOURCES.COMMENTS, label: "Comments" },
  { key: CORE_RESOURCES.REPORTS, label: "Reports" },
  { key: CORE_RESOURCES.DASHBOARD, label: "Dashboard" },
];

export default function AdminUserPermissionsPage() {
  return <UserPermissionsView basePath="/admin/management/users" resources={RESOURCES} />;
}
