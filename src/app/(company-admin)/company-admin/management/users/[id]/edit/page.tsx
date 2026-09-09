import { UserEditView } from "@/components/users/user-edit-view";
import { USER_LAYERS } from "@/lib/permissions/constants";

// Role editing is on here (requirement #18 - a moderator's role can change
// while they're logged in, e.g. Recruiter -> Content Moderator): the
// picker is scoped to the target's own MODERATOR layer via
// GET /api/roles/assignable?layer=MODERATOR, which already only returns the
// shared default plus this Company Admin's own custom roles.
export default function EditModeratorPage() {
  return (
    <UserEditView
      basePath="/company-admin/management/users"
      allowRoleEdit
      listHref={`/company-admin/management?layer=${USER_LAYERS.MODERATOR}`}
    />
  );
}
