import type { ReactNode } from "react";

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{title}</legend>
      {description && <p className="-mt-2 text-sm text-ink-soft">{description}</p>}
      {children}
    </fieldset>
  );
}
