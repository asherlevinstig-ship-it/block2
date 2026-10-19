import { describe, expect, it } from "vitest";
import { advanceFirstCombatPhase, completesFirstCombatLesson, FIRST_COMBAT_MOB_ID, firstCombatLesson } from "./first-combat-lesson.js";

describe("first combat lesson", () => {
  it("gives every Calling a distinct tactical lesson", () => {
    const paths = ["tank", "mage", "assassin", "thief", "ranger", "healer"] as const;
    const lessons = paths.map(path => firstCombatLesson(path, "dodge"));
    expect(new Set(lessons.map(lesson => lesson.title)).size).toBe(paths.length);
    expect(lessons.every(lesson => lesson.detail.includes("Southroad Crawler"))).toBe(true);
    expect(lessons.every(lesson => lesson.detail.includes("Space"))).toBe(true);
  });

  it("teaches strike, successful dodge, then finishing blow in order", () => {
    expect(firstCombatLesson("assassin", "attack").title).toContain("1/3 STRIKE");
    expect(firstCombatLesson("assassin", "finish").title).toContain("3/3 FINISH");
    expect(advanceFirstCombatPhase("attack", "perfect_dodge", FIRST_COMBAT_MOB_ID)).toBe("attack");
    expect(advanceFirstCombatPhase("attack", "hit", FIRST_COMBAT_MOB_ID)).toBe("dodge");
    expect(advanceFirstCombatPhase("dodge", "perfect_dodge", FIRST_COMBAT_MOB_ID)).toBe("finish");
    expect(advanceFirstCombatPhase("dodge", "perfect_dodge", "stone-brute")).toBe("dodge");
  });

  it("finishes only when the local player defeats the fixed southroad opponent", () => {
    expect(completesFirstCombatLesson(true, FIRST_COMBAT_MOB_ID, true)).toBe(true);
    expect(completesFirstCombatLesson(true, FIRST_COMBAT_MOB_ID, true, "dodge")).toBe(false);
    expect(completesFirstCombatLesson(true, FIRST_COMBAT_MOB_ID, false)).toBe(false);
    expect(completesFirstCombatLesson(false, FIRST_COMBAT_MOB_ID, true)).toBe(false);
    expect(completesFirstCombatLesson(true, "stone-brute", true)).toBe(false);
  });
});
