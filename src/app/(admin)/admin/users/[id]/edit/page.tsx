import { UserEditView } from "@/components/users/user-edit-view";

export default function EditUserPage() {
  return <UserEditView basePath="/admin/users" allowRoleEdit />;
}
