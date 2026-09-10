"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import {
  PERMISSION_ACTIONS,
  EMPTY_RESOURCE_PERMISSIONS,
  type PermissionAction,
  type PermissionMap,
  type ResourcePermissions,
} from "@/lib/permissions/constants";
import { cn } from "@/lib/utils/cn";

export type PermissionMatrixProps = {
  resources: { key: string; label: string }[];
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
  /**
   * A read-only baseline layered UNDER `value` - e.g. a user's role-derived
   * permissions when `value` is their per-user override map. A cell granted
   * here always renders checked and cannot be unchecked (union/OR-only
   * merge - see role-hierarchy.ts - means an override can never revoke a
   * role grant, so letting it be toggled here would be misleading). Bulk
   * actions (column / "All Permissions") only ever add or remove cells in
   * `value`, never touch `lockedValue`.
   */
  lockedValue?: PermissionMap;
};

type TriState = "checked" | "unchecked" | "indeterminate";

/** A checkbox that can render the native indeterminate visual state (not settable via a plain HTML attribute) for the bulk-select controls below. */
function TriStateCheckbox({
  state,
  onToggle,
  disabled,
  label,
}: {
  state: TriState;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "indeterminate";
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "checked"}
      onChange={onToggle}
      disabled={disabled}
      aria-label={label}
      className={cn("h-4 w-4 rounded border-line accent-accent", disabled && "cursor-not-allowed opacity-60")}
    />
  );
}

function triState(granted: number, total: number): TriState {
  if (total === 0 || granted === 0) return "unchecked";
  return granted === total ? "checked" : "indeterminate";
}

/**
 * The admin-facing permission matrix (requirement #70). The BACKEND
 * independently re-validates every permission on save (role-create /
 * role-update schemas + services) - this UI is convenience only.
 *
 * The "All Permissions" and per-action column checkboxes are pure
 * bulk-select convenience layered on the same `value`/`onChange` shape the
 * single-cell toggle already used - they only ever call `onChange` with a
 * fully-formed PermissionMap (touching `value` alone, never `lockedValue`),
 * so the permission model and save logic are unchanged.
 */
export function PermissionMatrix({ resources, value, onChange, disabled, lockedValue }: PermissionMatrixProps) {
  function permsFor(resourceKey: string): ResourcePermissions {
    return value[resourceKey] ?? EMPTY_RESOURCE_PERMISSIONS;
  }

  function lockedPermsFor(resourceKey: string): ResourcePermissions {
    return lockedValue?.[resourceKey] ?? EMPTY_RESOURCE_PERMISSIONS;
  }

  function isLocked(resourceKey: string, action: PermissionAction): boolean {
    return Boolean(lockedPermsFor(resourceKey)[action]);
  }

  /** Checked/unchecked as actually rendered - the locked baseline OR the editable override. */
  function effectiveFor(resourceKey: string, action: PermissionAction): boolean {
    return isLocked(resourceKey, action) || Boolean(permsFor(resourceKey)[action]);
  }

  function toggle(resourceKey: string, action: PermissionAction) {
    if (disabled || isLocked(resourceKey, action)) return;
    const current = permsFor(resourceKey);
    onChange({ ...value, [resourceKey]: { ...current, [action]: !current[action] } });
  }

  function columnState(action: PermissionAction): TriState {
    const granted = resources.filter((r) => effectiveFor(r.key, action)).length;
    return triState(granted, resources.length);
  }

  /** Whether a column/"All Permissions" checkbox has anything left to toggle - a column that's fully role-locked already shows checked and has nothing for a bulk action to change. */
  function hasEditableCell(action?: PermissionAction): boolean {
    const actions = action ? [action] : PERMISSION_ACTIONS;
    return resources.some((r) => actions.some((a) => !isLocked(r.key, a)));
  }

  function toggleColumn(action: PermissionAction) {
    if (disabled || !hasEditableCell(action)) return;
    const nextValue = columnState(action) !== "checked";
    const next: PermissionMap = { ...value };
    for (const resource of resources) {
      if (isLocked(resource.key, action)) continue;
      next[resource.key] = { ...permsFor(resource.key), [action]: nextValue };
    }
    onChange(next);
  }

  function allPermissionsState(): TriState {
    let granted = 0;
    for (const resource of resources) {
      for (const action of PERMISSION_ACTIONS) if (effectiveFor(resource.key, action)) granted++;
    }
    return triState(granted, resources.length * PERMISSION_ACTIONS.length);
  }

  function toggleAllPermissions() {
    if (disabled || !hasEditableCell()) return;
    const nextValue = allPermissionsState() !== "checked";
    const next: PermissionMap = { ...value };
    for (const resource of resources) {
      const current = permsFor(resource.key);
      const updated = { ...current };
      for (const action of PERMISSION_ACTIONS) {
        if (!isLocked(resource.key, action)) updated[action] = nextValue;
      }
      next[resource.key] = updated;
    }
    onChange(next);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
        <TriStateCheckbox
          state={allPermissionsState()}
          onToggle={toggleAllPermissions}
          disabled={disabled || !hasEditableCell()}
          label="Select all permissions for every resource"
        />
        <span className="text-sm font-medium text-ink">All Permissions</span>
        {lockedValue && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-soft">
            <Lock className="h-3 w-3" /> granted by role
          </span>
        )}
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-soft">
            <th className="px-4 py-2.5 font-medium">Resource</th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} className="px-4 py-2.5 text-center font-medium capitalize">
                <span className="inline-flex items-center gap-1.5">
                  <TriStateCheckbox
                    state={columnState(action)}
                    onToggle={() => toggleColumn(action)}
                    disabled={disabled || !hasEditableCell(action)}
                    label={`Select ${action} for all resources`}
                  />
                  {action}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.key} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-medium text-ink">{resource.label}</td>
              {PERMISSION_ACTIONS.map((action) => {
                const locked = isLocked(resource.key, action);
                const checked = effectiveFor(resource.key, action);
                return (
                  <td key={action} className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      disabled={disabled || locked}
                      onClick={() => toggle(resource.key, action)}
                      aria-pressed={checked}
                      aria-label={
                        locked ? `${resource.label} - ${action} (granted by role)` : `${resource.label} - ${action}`
                      }
                      title={locked ? "Granted by role - cannot be revoked here" : undefined}
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded border transition-colors",
                        checked
                          ? locked
                            ? "border-accent/40 bg-accent-soft text-accent"
                            : "border-accent bg-accent text-white"
                          : "border-line bg-surface text-transparent",
                        (disabled || locked) && "cursor-not-allowed",
                        disabled && "opacity-60"
                      )}
                    >
                      {locked ? <Lock className="h-3 w-3" /> : "✓"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
