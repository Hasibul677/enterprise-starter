import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
    </div>
  );
}
