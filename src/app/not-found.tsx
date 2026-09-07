import Link from "next/link";
import { NotFoundState } from "@/components/feedback/not-found";

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper p-6">
      <NotFoundState label="Page not found" />
      <Link href="/dashboard" className="text-sm font-medium text-accent">
        Back to dashboard
      </Link>
    </div>
  );
}
