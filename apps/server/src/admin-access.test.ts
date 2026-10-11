import { describe, expect, it } from "vitest";
import { adminProfileKey, matchesAdminBootstrapPass, sha256 } from "./admin-access.js";

describe("admin access", () => {
  it("uses constant-time hash comparison without storing the invitation in source", () => {
    const invitation = "a".repeat(64);
    expect(matchesAdminBootstrapPass(invitation, sha256(invitation))).toBe(true);
    expect(matchesAdminBootstrapPass("b".repeat(64), sha256(invitation))).toBe(false);
    expect(matchesAdminBootstrapPass("short", sha256(invitation))).toBe(false);
  });

  it("derives an opaque stable account key", () => {
    const key = adminProfileKey("guest_0123456789abcdef0123456789abcdef");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("guest_");
  });
});
