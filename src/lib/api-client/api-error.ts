import type { ErrorFieldDetail } from "@/lib/errors/app-error";

/** Normalized client-side error shape - every caller of apiClient.* deals with exactly this. */
export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: ErrorFieldDetail[];

  constructor(message: string, statusCode: number, code: string, errors?: ErrorFieldDetail[]) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}

export class NetworkError extends ApiClientError {
  constructor() {
    super("Network error. Please check your connection.", 0, "NETWORK_ERROR");
  }
}
