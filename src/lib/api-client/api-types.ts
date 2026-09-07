export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  code: string;
  message: string;
  data: T | null;
  meta?: { pagination?: import("@/lib/api/response").PaginationMeta };
  errors?: import("@/lib/errors/app-error").ErrorFieldDetail[];
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Internal: set true on the retry-after-refresh call to prevent infinite refresh loops. */
  _isRetry?: boolean;
};
