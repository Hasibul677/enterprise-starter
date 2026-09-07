import bcrypt from "bcryptjs";

/**
 * Centralized password hashing. bcryptjs is used because it is a pure-JS
 * implementation with no native build step, which keeps the starter portable
 * across serverless/edge-adjacent Node runtimes. Swap for a native argon2
 * binding if your deployment target supports native modules and you want
 * stronger memory-hardness guarantees.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Baseline password strength policy. Extend as needed (breached-password
 * lists, entropy scoring, etc.) - keep the rule centralized here so it is
 * never duplicated across registration/reset/admin-create flows.
 */
export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < 8) return false;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasLower && hasUpper && hasDigit;
}
