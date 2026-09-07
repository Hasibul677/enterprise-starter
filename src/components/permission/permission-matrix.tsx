"use client";

import { PERMISSION_ACTIONS, type PermissionAction, type PermissionMap } from "@/lib/permissions/constants";
import { cn } from "@/lib/utils/cn";

export type PermissionMatrixProps = {
  resources: { key: string; label: string }[];
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
};

/**
 * The admin-facing permission matrix (requirement #70). The BACKEND
 * independently re-validates every permission on save (role-create /
 * role-update schemas + services) - this UI is convenience only.
 */
export function PermissionMatrix({ resources, value, onChange, disabled }: PermissionMatrixProps) {
  function toggle(resourceKey: string, action: PermissionAction) {
    if (disabled) return;
    const current = value[resourceKey] ?? { view: false, add: false, edit: false, delete: false };
    onChange({
      ...value,
      [resourceKey]: { ...current, [action]: !current[action] },
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-soft">
            <th className="px-4 py-2.5 font-medium">Resource</th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} className="px-4 py-2.5 text-center font-medium capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const perms = value[resource.key] ?? { view: false, add: false, edit: false, delete: false };
            return (
              <tr key={resource.key} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{resource.label}</td>
                {PERMISSION_ACTIONS.map((action) => (
                  <td key={action} className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(resource.key, action)}
                      aria-pressed={perms[action]}
                      aria-label={`${resource.label} - ${action}`}
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded border transition-colors",
                        perms[action] ? "border-accent bg-accent text-white" : "border-line bg-surface text-transparent",
                        disabled && "cursor-not-allowed opacity-60"
                      )}
                    >
                      ✓
                    </button>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
