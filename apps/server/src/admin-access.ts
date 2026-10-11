import { createHash, timingSafeEqual } from "node:crypto";

const ADMIN_BOOTSTRAP_PASS_HASH = "24381bac5abd5814173d457cd1ba4c0088b92b82b925313ef495f46a14affc9f";

export const ADMIN_PROFILE_HASH = "blockcraft:admin-profiles:v1";
export const ADMIN_BOOTSTRAP_HASH = "blockcraft:admin-bootstrap:v1";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function adminProfileKey(profileToken: string): string {
  return sha256(`blockcraft-admin-profile:${profileToken}`);
}

export function matchesAdminBootstrapPass(value: unknown, expectedHash = ADMIN_BOOTSTRAP_PASS_HASH): boolean {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
