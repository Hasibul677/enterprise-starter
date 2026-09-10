import { redirect } from "next/navigation";
import { resolveCurrentAccess, type ResolvedAccess } from "@/lib/auth/current-user";
import { getDefaultLandingRoute } from "@/lib/permissions/role-hierarchy";

export default async function RootPage() {
  // redirect() throws internally - it must never be called inside a
  // try/catch, or the catch swallows that throw and this would fall through
  // to redirect("/login") unconditionally, even for an authenticated user
  // (see node_modules/next/dist/docs/.../functions/redirect.md "Behavior").
  let access: ResolvedAccess | null;
  try {
    access = await resolveCurrentAccess();
  } catch {
    access = null;
  }

  redirect(access ? getDefaultLandingRoute(access) : "/login");
}
