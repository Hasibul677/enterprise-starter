import { UserDetailView } from "@/components/users/user-detail-view";

export default async function UserDetailsPage({ searchParams }: { searchParams: Promise<{ layer?: string }> }) {
  const { layer } = await searchParams;

  return (
    <UserDetailView
      basePath="/admin/management/users"
      backLabel="Back to users"
      listHref={layer ? `/admin/management?layer=${layer}` : "/admin/management"}
    />
  );
}
