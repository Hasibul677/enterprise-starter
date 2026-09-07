import { Loader2 } from "lucide-react";

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
