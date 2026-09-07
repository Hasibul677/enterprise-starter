import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, type ErrorFieldDetail } from "@/lib/errors/app-error";

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  code: string;
  message: string;
  data: T | null;
  meta?: { pagination?: PaginationMeta };
  errors?: ErrorFieldDetail[];
};

export function ok<T>(
  data: T,
  options?: { code?: string; message?: string; statusCode?: number; meta?: ApiResponse<T>["meta"] }
): NextResponse<ApiResponse<T>> {
  const statusCode = options?.statusCode ?? 200;
  return NextResponse.json(
    {
      success: true,
      statusCode,
      code: options?.code ?? "OK",
      message: options?.message ?? "Request successful.",
      data,
      ...(options?.meta ? { meta: options.meta } : {}),
    },
    { status: statusCode }
  );
}

export function created<T>(data: T, code = "CREATED", message = "Resource created successfully."): NextResponse<ApiResponse<T>> {
  return ok(data, { code, message, statusCode: 201 });
}

export function fail(
  statusCode: number,
  code: string,
  message: string,
  errors?: ErrorFieldDetail[]
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, statusCode, code, message, data: null, ...(errors ? { errors } : {}) },
    { status: statusCode }
  );
}

/**
 * Single funnel for turning any thrown value into a safe ApiResponse.
 * Never leaks stack traces, DB internals, or secrets to the client.
 */
export function handleRouteError(err: unknown): NextResponse<ApiResponse<null>> {
  if (err instanceof ZodError) {
    const errors: ErrorFieldDetail[] = err.issues.map((issue) => ({
      field: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    }));
    return fail(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", errors);
  }

  if (err instanceof AppError) {
    return fail(err.statusCode, err.code, err.message, err.errors);
  }

  // MongoDB duplicate key error
  if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
    return fail(409, "DUPLICATE_KEY", "A resource with these details already exists.");
  }

  console.error("Unhandled server error:", err);
  return fail(500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again later.");
}
