import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function ContentContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1100px] p-6", className)}>{children}</div>;
}
