import { UserEditView } from "@/components/users/user-edit-view";

export default async function EditUserPage({ searchParams }: { searchParams: Promise<{ layer?: string }> }) {
  const { layer } = await searchParams;

  return (
    <UserEditView
      basePath="/admin/management/users"
      allowRoleEdit
      listHref={layer ? `/admin/management?layer=${layer}` : "/admin/management"}
    />
  );
}
