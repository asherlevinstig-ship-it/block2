import { describe, expect, it } from "vitest";
import { incomingLootAdvice, swapCandidateReason, swapCandidateScore } from "./loot-recommendation.js";

describe("beginner loot recommendations", () => {
  it("prioritises clear upgrades and Calling matches", () => {
    expect(incomingLootAdvice({ decision: "upgrade", owned: 0, callingMatch: false, rarityOrder: 1, canSalvage: true }))
      .toMatchObject({ tone: "good", label: "UPGRADE — TAKE IT" });
    expect(incomingLootAdvice({ decision: "different", owned: 0, callingMatch: true, rarityOrder: 1, canSalvage: true }))
      .toMatchObject({ tone: "good", label: "YOUR CALLING — TAKE IT" });
  });

  it("protects rare finds from a simplistic lower-stat verdict", () => {
    expect(incomingLootAdvice({ decision: "lower", owned: 0, callingMatch: false, rarityOrder: 4, canSalvage: true }))
      .toMatchObject({ tone: "good", label: "RARE FIND — KEEP IT" });
  });

  it("recommends spare common items before rare or Calling gear", () => {
    const spareCommon = { rarityOrder: 0, quantity: 2, equipment: false, callingMatch: false, decision: null } as const;
    const rareGear = { rarityOrder: 3, quantity: 1, equipment: true, callingMatch: false, decision: "different" } as const;
    const callingGear = { rarityOrder: 1, quantity: 1, equipment: true, callingMatch: true, decision: "same" } as const;
    expect(swapCandidateScore(spareCommon)).toBeLessThan(swapCandidateScore(rareGear));
    expect(swapCandidateScore(spareCommon)).toBeLessThan(swapCandidateScore(callingGear));
    expect(swapCandidateReason(spareCommon)).toBe("SPARE COPY");
  });
});
