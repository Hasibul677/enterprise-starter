import { redirect } from "next/navigation";
import { resolveCurrentAccess } from "@/lib/auth/current-user";

export default async function RootPage() {
  try {
    const access = await resolveCurrentAccess();
    redirect(access.isSuperAdmin ? "/admin" : "/dashboard");
  } catch {
    redirect("/login");
  }
}
