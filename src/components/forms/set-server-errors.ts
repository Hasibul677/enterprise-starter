import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import type { ErrorFieldDetail } from "@/lib/errors/app-error";

/**
 * Maps API validation errors (ApiResponse.errors[]) into React Hook Form's
 * setError(), so backend validation appears directly beside the offending
 * field (requirement #41) instead of as a generic toast.
 */
export function applyServerErrors<T extends FieldValues>(setError: UseFormSetError<T>, errors?: ErrorFieldDetail[]) {
  if (!errors) return;
  for (const err of errors) {
    if (err.field) {
      setError(err.field as Path<T>, { type: "server", message: err.message });
    }
  }
}
