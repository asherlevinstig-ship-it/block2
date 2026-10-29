import { describe, expect, it } from "vitest";
import { CALLING_ABILITY_OPTIONS } from "@blockcraft/protocol";
import { ABILITY_PRACTICE_DUMMY_RADIUS, abilityPracticeDummyInRange, abilityPracticeLesson } from "./ability-practice-dummy.js";

describe("Town ability practice dummy", () => {
  it("teaches every Calling ability from the authoritative definition", () => {
    for (const ability of CALLING_ABILITY_OPTIONS)
      expect(abilityPracticeLesson(ability.id)).toEqual({ name: ability.name, description: ability.description });
  });

  it("only teaches casts made inside its visible practice radius", () => {
    const dummy = { x: 12.5, z: 12.5 };
    expect(abilityPracticeDummyInRange({ x: dummy.x + ABILITY_PRACTICE_DUMMY_RADIUS, z: dummy.z }, dummy)).toBe(true);
    expect(abilityPracticeDummyInRange({ x: dummy.x + ABILITY_PRACTICE_DUMMY_RADIUS + .01, z: dummy.z }, dummy)).toBe(false);
  });
});
