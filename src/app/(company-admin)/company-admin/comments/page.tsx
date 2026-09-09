import { ResourceStubView } from "@/components/layout/resource-stub-view";

export default function CommentsPage() {
  return (
    <ResourceStubView
      title="Comments"
      description="Moderate comments within your Company Admin / Moderator scope."
      endpoint="/api/comments"
    />
  );
}
