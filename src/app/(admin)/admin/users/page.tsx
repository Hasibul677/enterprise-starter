import { UserListView } from "@/components/users/user-list-view";

export default function UsersPage() {
  return (
    <UserListView
      basePath="/admin/users"
      title="Users"
      description="Manage user accounts, roles, and status."
      createLabel="Add user"
      emptyTitle="No users yet"
      emptyDescription="Create your first user to get started."
    />
  );
}
