import { UserListView } from "@/components/users/user-list-view";

export default function ModeratorsPage() {
  return (
    <UserListView
      basePath="/normal-admin/users"
      title="Moderators"
      description="Manage the moderator accounts you created."
      createLabel="Add moderator"
      emptyTitle="No moderators yet"
      emptyDescription="Create your first moderator to get started."
    />
  );
}
