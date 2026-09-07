import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/security/password";

describe("password security", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    expect(hash).not.toBe("Sup3rSecret!");
    expect(await verifyPassword("Sup3rSecret!", hash)).toBe(true);
  });

  it("rejects an incorrect password against a stored hash", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    expect(await verifyPassword("WrongPassword1", hash)).toBe(false);
  });

  it("never stores the plaintext password inside the hash output", async () => {
    const hash = await hashPassword("PlainTextValue1");
    expect(hash).not.toContain("PlainTextValue1");
  });

  describe("isPasswordStrongEnough", () => {
    it("accepts a password with upper/lower/digit and min length", () => {
      expect(isPasswordStrongEnough("GoodPass1")).toBe(true);
    });
    it("rejects passwords under 8 characters", () => {
      expect(isPasswordStrongEnough("Ab1")).toBe(false);
    });
    it("rejects passwords missing a digit", () => {
      expect(isPasswordStrongEnough("NoDigitsHere")).toBe(false);
    });
    it("rejects passwords missing an uppercase letter", () => {
      expect(isPasswordStrongEnough("alllower1")).toBe(false);
    });
  });
});
