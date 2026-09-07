import { test, expect } from "@playwright/test";

/**
 * Critical authentication E2E coverage (requirement #61).
 * Requires a running MongoDB (MONGODB_URI) and a seeded database (`yarn seed`)
 * before running `yarn test:e2e` - see the note in playwright.config.ts about
 * browser binaries in sandboxed environments.
 */

test.describe("Authentication flow", () => {
  test("an unauthenticated visitor is redirected from a protected page to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("registration rejects a client-supplied privileged role field (requirement #8)", async ({ request }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const response = await request.post("/api/auth/register", {
      data: {
        firstName: "Test",
        lastName: "User",
        email,
        password: "GoodPass1",
        // Attempted privilege escalation - must be silently ignored/stripped.
        roles: ["SUPER_ADMIN"],
        isSuperAdmin: true,
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.user.roles).not.toContain("SUPER_ADMIN");
  });

  test("a user can register, then log in, and reach the dashboard", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name").fill("User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("GoodPass1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("GoodPass1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("logging in with an invalid password does not reveal whether the email exists (requirement #30)", async ({ request }) => {
    const unknownEmailResponse = await request.post("/api/auth/login", {
      data: { email: "definitely-not-registered@example.com", password: "WrongPass1" },
    });
    const knownEmailResponse = await request.post("/api/auth/login", {
      data: { email: "admin@example.com", password: "WrongPass1" },
    });

    const unknownBody = await unknownEmailResponse.json();
    const knownBody = await knownEmailResponse.json();

    expect(unknownEmailResponse.status()).toBe(401);
    expect(knownEmailResponse.status()).toBe(401);
    expect(unknownBody.message).toBe(knownBody.message);
    expect(unknownBody.code).toBe(knownBody.code);
  });

  test("a user without users.delete permission gets 403 from DELETE /api/users/:id (requirement #62.2)", async ({ request }) => {
    const email = `e2e-viewer-${Date.now()}@example.com`;
    await request.post("/api/auth/register", {
      data: { firstName: "Viewer", lastName: "User", email, password: "GoodPass1" },
    });
    const loginResponse = await request.post("/api/auth/login", { data: { email, password: "GoodPass1" } });
    expect(loginResponse.ok()).toBeTruthy();

    const response = await request.delete("/api/users/000000000000000000000000");
    expect(response.status()).toBe(403);
  });
});
