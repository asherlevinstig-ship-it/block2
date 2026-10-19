import { describe, expect, it } from "vitest";
import { completesFirstCombatLesson, FIRST_COMBAT_MOB_ID, firstCombatLesson } from "./first-combat-lesson.js";

describe("first combat lesson", () => {
  it("gives every Calling a distinct tactical lesson", () => {
    const paths = ["tank", "mage", "assassin", "thief", "ranger", "healer"] as const;
    const lessons = paths.map(path => firstCombatLesson(path));
    expect(new Set(lessons.map(lesson => lesson.title)).size).toBe(paths.length);
    expect(lessons.every(lesson => lesson.detail.includes("Southroad Crawler"))).toBe(true);
    expect(lessons.every(lesson => lesson.detail.includes("Space"))).toBe(true);
  });

  it("finishes only when the local player defeats the fixed southroad opponent", () => {
    expect(completesFirstCombatLesson(true, FIRST_COMBAT_MOB_ID, true)).toBe(true);
    expect(completesFirstCombatLesson(true, FIRST_COMBAT_MOB_ID, false)).toBe(false);
    expect(completesFirstCombatLesson(false, FIRST_COMBAT_MOB_ID, true)).toBe(false);
    expect(completesFirstCombatLesson(true, "stone-brute", true)).toBe(false);
  });
});
