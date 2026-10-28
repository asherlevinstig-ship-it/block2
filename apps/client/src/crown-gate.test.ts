import { describe, expect, it } from "vitest";
import { crownGateStatus } from "./crown-gate.js";

describe("Crownkeeper gate requirements", () => {
  it("explains both seals and identifies either surviving Warden", () => {
    expect(crownGateStatus(true, true).remaining).toBe(2);
    expect(crownGateStatus(true, false).detail).toContain("North Root Warden");
    expect(crownGateStatus(false, true).detail).toContain("South Root Warden");
  });
  it("only invites entry after both Wardens are defeated", () => {
    expect(crownGateStatus(false, false)).toMatchObject({ remaining: 0, title: "Crownkeeper Court · OPEN" });
    expect(crownGateStatus(false, false).detail).toContain("Walk through");
  });
});
