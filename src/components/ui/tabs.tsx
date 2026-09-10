import { cn } from "@/lib/utils/cn";

export type TabItem<T extends string = string> = { value: T; label: string; disabled?: boolean };

/**
 * Minimal accessible tab bar - no tabs primitive existed in this design
 * system before the layer-tabbed management area. Panels are the caller's
 * responsibility (conditional render based on `value`); this only renders
 * the tablist and reports selection changes.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={item.disabled}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
              item.disabled
                ? "cursor-not-allowed text-ink-soft/40"
                : selected
                  ? "border-b-2 border-accent bg-accent-soft text-accent"
                  : "text-ink-soft hover:bg-paper hover:text-ink"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
