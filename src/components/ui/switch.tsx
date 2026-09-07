"use client";

import { cn } from "@/lib/utils/cn";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
};

export function Switch({ checked, onChange, disabled, label, id }: SwitchProps) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-ink">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-surface transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
      {label}
    </label>
  );
}
