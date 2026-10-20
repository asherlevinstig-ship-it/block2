import { describe, expect, it } from "vitest";
import { abilityPracticeChallenge, isStarterPracticeAbility, practiceFollowUpProgress, practicePhaseAfterCast } from "./ability-practice.js";

describe("class-specific first ability practice", () => {
  it("gives every Calling a mechanic-specific instruction", () => {
    expect(abilityPracticeChallenge("tank").castInstruction).toContain("test strike");
    expect(abilityPracticeChallenge("mage").castInstruction).toContain("three target projections");
    expect(abilityPracticeChallenge("assassin").followUpInstruction).toContain("empowered strike");
    expect(abilityPracticeChallenge("thief").castInstruction).toContain("break pursuit");
    expect(abilityPracticeChallenge("ranger").followUpHits).toBe(3);
    expect(abilityPracticeChallenge("healer").castInstruction).toContain("heal");
  });

  it("requires follow-up execution only where the fantasy needs it", () => {
    expect(practicePhaseAfterCast("assassin")).toBe("follow_up");
    expect(practicePhaseAfterCast("ranger")).toBe("follow_up");
    expect(practicePhaseAfterCast("tank")).toBe("follow_up");
    expect(practicePhaseAfterCast("mage")).toBe("complete");
  });

  it("counts the Ranger's three shots and the Assassin's single strike", () => {
    expect(practiceFollowUpProgress("ranger", 1)).toEqual({ hits: 2, complete: false });
    expect(practiceFollowUpProgress("ranger", 2)).toEqual({ hits: 3, complete: true });
    expect(practiceFollowUpProgress("assassin", 0)).toEqual({ hits: 1, complete: true });
  });

  it("only treats each Calling's starter Power as an onboarding trial", () => {
    expect(isStarterPracticeAbility("healer_field_mend")).toBe(true);
    expect(isStarterPracticeAbility("healer_resurrection")).toBe(false);
  });
});
