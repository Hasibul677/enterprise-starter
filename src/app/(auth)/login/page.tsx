import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Loading } from "@/components/feedback/loading";

export default function LoginPage() {
  // Read server-side (never as `process.env.NEXT_PUBLIC_*` inside a "use
  // client" file) and passed down as a prop, so the value is never baked
  // into a long-lived static client JS chunk - this route is dynamically
  // rendered, so this reads the live value fresh on every request. See
  // .env.example: if this value ever looks truncated/wrong locally, check
  // for a literal "$" followed by digits in your .env file - `@next/env`'s
  // dotenv-expand step treats that as a reference to another variable
  // (e.g. "$321" -> variable "321") and silently drops it. Escape a literal
  // "$" as "\$" in .env files. This does NOT affect Vercel/production,
  // where env vars are injected directly with no .env file involved.
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || undefined;
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || undefined;

  return (
    <Suspense fallback={<Loading label="Loading sign-in..." />}>
      <LoginForm demoEmail={demoEmail} demoPassword={demoPassword} />
    </Suspense>
  );
}
