/**
 * Centralized error hierarchy.
 * Route handlers should catch these (via handleRouteError) and translate
 * them into the common ApiResponse envelope - never leak raw error internals.
 */

export type ErrorFieldDetail = {
  field?: string;
  code?: string;
  message: string;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: ErrorFieldDetail[];

  constructor(
    message: string,
    statusCode: number,
    code: string,
    errors?: ErrorFieldDetail[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed.", errors?: ErrorFieldDetail[]) {
    super(message, 422, "VALIDATION_ERROR", errors);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required.", code = "UNAUTHENTICATED") {
    super(message, 401, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicting state.") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMITED");
  }
}

export class AccountStatusError extends AppError {
  constructor(message: string, code: string) {
    super(message, 403, code);
  }
}

export class CsrfError extends AppError {
  constructor(message = "Invalid CSRF token.") {
    super(message, 403, "CSRF_INVALID");
  }
}
