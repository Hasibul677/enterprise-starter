import { redirect } from "next/navigation";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { getDefaultLandingRoute } from "@/lib/permissions/role-hierarchy";

export default async function RootPage() {
  try {
    const access = await resolveCurrentAccess();
    redirect(getDefaultLandingRoute(access));
  } catch {
    redirect("/login");
  }
}
