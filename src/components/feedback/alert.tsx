import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AlertVariant = "success" | "warning" | "danger" | "info";

const styles: Record<AlertVariant, { wrap: string; icon: ReactNode }> = {
  success: { wrap: "bg-success-soft text-success border-success/30", icon: <CheckCircle2 className="h-4 w-4" /> },
  warning: { wrap: "bg-warning-soft text-warning border-warning/30", icon: <AlertTriangle className="h-4 w-4" /> },
  danger: { wrap: "bg-danger-soft text-danger border-danger/30", icon: <XCircle className="h-4 w-4" /> },
  info: { wrap: "bg-accent-soft text-accent border-accent/30", icon: <Info className="h-4 w-4" /> },
};

export function Alert({ variant = "info", children, className }: { variant?: AlertVariant; children: ReactNode; className?: string }) {
  const style = styles[variant];
  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", style.wrap, className)}>
      {style.icon}
      <div>{children}</div>
    </div>
  );
}
