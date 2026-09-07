"use client";

import { cn } from "@/lib/utils/cn";
import type { SelectOption } from "./select";

export type MultiSelectProps = {
  options: SelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
};

/** Simple, accessible checkbox-list multi-select (avoids reinventing a combobox for the starter). */
export function MultiSelect({ options, value, onChange, disabled, className }: MultiSelectProps) {
  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-line bg-surface p-3", className)}>
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            disabled={disabled}
            className="h-4 w-4 rounded border-line accent-accent"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
