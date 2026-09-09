import { UserCreateView } from "@/components/users/user-create-view";
import { USER_LAYER_VALUES, type UserLayer } from "@/lib/permissions/constants";

export default async function NewUserPage({ searchParams }: { searchParams: Promise<{ layer?: string }> }) {
  const { layer } = await searchParams;
  const initialLayer = layer && (USER_LAYER_VALUES as readonly string[]).includes(layer) ? (layer as UserLayer) : undefined;

  return (
    <UserCreateView
      basePath="/admin/management/users"
      initialLayer={initialLayer}
      listHref={initialLayer ? `/admin/management?layer=${initialLayer}` : "/admin/management"}
    />
  );
}
