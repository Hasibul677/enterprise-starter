import { z } from "zod";

/**
 * Validates a route param as a MongoDB ObjectId shape (requirement #29 -
 * "IDs" is explicitly listed among the things Zod must validate). Using
 * this at the top of every `[id]/route.ts` handler turns a malformed id
 * into a clean 422 VALIDATION_ERROR instead of an unhandled Mongoose
 * CastError bubbling up as a generic 500.
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format.");

export function parseObjectId(id: string): string {
  return objectIdSchema.parse(id);
}
