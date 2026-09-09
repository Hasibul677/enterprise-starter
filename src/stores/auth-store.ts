"use client";

import { create } from "zustand";
import { USER_LAYERS } from "@/lib/permissions/constants";
import type { PermissionMap, UserLayer } from "@/lib/permissions/constants";

export type SessionUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
};

export type MenuTreeNode = {
  _id: string;
  label: string;
  route?: string | null;
  icon?: string | null;
  children: MenuTreeNode[];
};

type AuthState = {
  user: SessionUser | null;
  permissions: PermissionMap;
  isSuperAdmin: boolean;
  /** The single source of hierarchy authority on the client - see role-hierarchy.ts. */
  userLayer: UserLayer;
  /** Display-only role slugs/labels (e.g. UI badges) - NEVER used for authority. */
  roleSlugs: string[];
  menus: MenuTreeNode[];
  warning: boolean;
  /** Requirement #21 - true iff the CURRENT session is a Super Admin impersonating this user. */
  isImpersonating: boolean;
  /** Baseline compared against GET /api/auth/session-state by use-permission-sync.ts to detect stale permissions/menus. */
  permissionVersion: number;
  hydrated: boolean;
  setSession: (payload: {
    user: SessionUser;
    permissions: PermissionMap;
    isSuperAdmin: boolean;
    userLayer: UserLayer;
    roleSlugs: string[];
    menus: MenuTreeNode[];
    warning: boolean;
    isImpersonating?: boolean;
    permissionVersion?: number;
  }) => void;
  clearSession: () => void;
};

/**
 * IMPORTANT: this store is a CONVENIENCE CACHE for rendering the UI
 * (menus, permission-gated buttons, user display name). It is populated
 * from GET /api/auth/me and is NEVER treated as an authorization source by
 * any server route - see requirement #47 and lib/permissions/guard.ts.
 * A user could edit this store's contents in devtools and would gain
 * nothing: every mutating API call is independently re-checked server-side.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: {},
  isSuperAdmin: false,
  userLayer: USER_LAYERS.CUSTOMER,
  roleSlugs: [],
  menus: [],
  warning: false,
  isImpersonating: false,
  permissionVersion: 0,
  hydrated: false,
  setSession: (payload) =>
    set({ ...payload, isImpersonating: payload.isImpersonating ?? false, permissionVersion: payload.permissionVersion ?? 0, hydrated: true }),
  clearSession: () =>
    set({
      user: null,
      permissions: {},
      isSuperAdmin: false,
      userLayer: USER_LAYERS.CUSTOMER,
      roleSlugs: [],
      menus: [],
      warning: false,
      isImpersonating: false,
      permissionVersion: 0,
      hydrated: true,
    }),
}));
