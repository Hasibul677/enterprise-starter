"use client";

import { create } from "zustand";
import type { PermissionMap, RoleSlug } from "@/lib/permissions/constants";

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
  roleSlugs: RoleSlug[];
  menus: MenuTreeNode[];
  warning: boolean;
  /** Requirement #21 - true iff the CURRENT session is a Super Admin impersonating this user. */
  isImpersonating: boolean;
  hydrated: boolean;
  setSession: (payload: {
    user: SessionUser;
    permissions: PermissionMap;
    isSuperAdmin: boolean;
    roleSlugs: RoleSlug[];
    menus: MenuTreeNode[];
    warning: boolean;
    isImpersonating?: boolean;
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
  roleSlugs: [],
  menus: [],
  warning: false,
  isImpersonating: false,
  hydrated: false,
  setSession: (payload) => set({ ...payload, isImpersonating: payload.isImpersonating ?? false, hydrated: true }),
  clearSession: () =>
    set({
      user: null,
      permissions: {},
      isSuperAdmin: false,
      roleSlugs: [],
      menus: [],
      warning: false,
      isImpersonating: false,
      hydrated: true,
    }),
}));
