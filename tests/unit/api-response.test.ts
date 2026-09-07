import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ok, created, fail, handleRouteError } from "@/lib/api/response";
import { ValidationError, NotFoundError, AuthorizationError } from "@/lib/errors/app-error";

async function bodyOf(response: Response) {
  return response.json();
}

describe("ApiResponse<T> envelope (requirement #26)", () => {
  it("ok() produces a success envelope with the expected shape", async () => {
    const response = ok({ hello: "world" }, { code: "OK", message: "Fetched." });
    const body = await bodyOf(response);
    expect(body).toMatchObject({
      success: true,
      statusCode: 200,
      code: "OK",
      message: "Fetched.",
      data: { hello: "world" },
    });
  });

  it("created() defaults to statusCode 201", async () => {
    const response = created({ id: "1" });
    expect(response.status).toBe(201);
    const body = await bodyOf(response);
    expect(body.statusCode).toBe(201);
    expect(body.success).toBe(true);
  });

  it("fail() produces a failure envelope with data: null", async () => {
    const response = fail(404, "NOT_FOUND", "Not found.");
    const body = await bodyOf(response);
    expect(body).toMatchObject({ success: false, statusCode: 404, code: "NOT_FOUND", data: null });
  });

  it("handleRouteError maps a ZodError to a 422 VALIDATION_ERROR with field-level errors", async () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);

    if (!result.success) {
      const response = handleRouteError(result.error);
      expect(response.status).toBe(422);
      const body = await bodyOf(response);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.errors?.[0]).toMatchObject({ field: "email" });
    }
  });

  it("handleRouteError maps a NotFoundError to a 404", async () => {
    const response = handleRouteError(new NotFoundError("User not found."));
    expect(response.status).toBe(404);
    const body = await bodyOf(response);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("User not found.");
  });

  it("handleRouteError maps an AuthorizationError to a 403", async () => {
    const response = handleRouteError(new AuthorizationError());
    expect(response.status).toBe(403);
    const body = await bodyOf(response);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("handleRouteError maps a Mongo duplicate-key error (code 11000) to a 409", async () => {
    const response = handleRouteError({ code: 11000 });
    expect(response.status).toBe(409);
    const body = await bodyOf(response);
    expect(body.code).toBe("DUPLICATE_KEY");
  });

  it("handleRouteError NEVER leaks stack traces or raw error details for an unknown error", async () => {
    const response = handleRouteError(new Error("some internal DB connection string leaked here"));
    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("DB connection string");
  });

  it("a custom ValidationError carries through its field-level errors", async () => {
    const response = handleRouteError(
      new ValidationError("Bad input.", [{ field: "password", message: "Too short." }])
    );
    const body = await bodyOf(response);
    expect(body.statusCode).toBe(422);
    expect(body.errors).toEqual([{ field: "password", message: "Too short." }]);
  });
});
