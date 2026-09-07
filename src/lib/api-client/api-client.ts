"use client";

import { ApiClientError, NetworkError } from "./api-error";
import type { ApiEnvelope, RequestOptions } from "./api-types";

const AUTH_EXPIRY_CODES = new Set(["ACCESS_TOKEN_EXPIRED", "NO_ACCESS_TOKEN"]);

/**
 * Single-flight refresh (requirement #23). If N requests fail concurrently
 * because the access token expired, only ONE POST /api/auth/refresh is ever
 * sent; every other caller awaits the same in-flight promise and then
 * retries its own original request exactly once.
 */
let refreshPromise: Promise<boolean> | null = null;

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function performRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const isMutating = method !== "GET" && method !== "HEAD";
  const csrfToken = isMutating ? getCsrfTokenFromCookie() : null;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: "include",
      signal: options.signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiClientError("Unexpected server response.", response.status, "INVALID_RESPONSE");
  }

  if (envelope.success) {
    return envelope.data as T;
  }

  // Silent-refresh-and-retry flow (requirement #22/#24): exactly one retry per original request.
  if (response.status === 401 && AUTH_EXPIRY_CODES.has(envelope.code) && !options._isRetry) {
    const refreshed = await performRefresh();
    if (refreshed) {
      return request<T>(method, path, body, { ...options, _isRetry: true });
    }
    // Refresh failed too (both tokens expired / revoked) -> hard logout.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
  }

  throw new ApiClientError(envelope.message, envelope.statusCode, envelope.code, envelope.errors);
}

async function requestWithMeta<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<{ data: T; meta?: ApiEnvelope<T>["meta"] }> {
  const isMutating = method !== "GET" && method !== "HEAD";
  const csrfToken = isMutating ? getCsrfTokenFromCookie() : null;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: "include",
      signal: options.signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  const envelope: ApiEnvelope<T> = await response.json();

  if (envelope.success) {
    return { data: envelope.data as T, meta: envelope.meta };
  }

  if (response.status === 401 && AUTH_EXPIRY_CODES.has(envelope.code) && !options._isRetry) {
    const refreshed = await performRefresh();
    if (refreshed) {
      return requestWithMeta<T>(method, path, body, { ...options, _isRetry: true });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
  }

  throw new ApiClientError(envelope.message, envelope.statusCode, envelope.code, envelope.errors);
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
  /** Use when you also need pagination meta (list endpoints). */
  getPaginated: <T>(path: string, options?: RequestOptions) => requestWithMeta<T>("GET", path, undefined, options),
};

export { ApiClientError, NetworkError };
