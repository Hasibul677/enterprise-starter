import { UserEditView } from "@/components/users/user-edit-view";

export default function EditModeratorPage() {
  return <UserEditView basePath="/normal-admin/users" allowRoleEdit={false} />;
}
