import { describe, expect, it } from "vitest";
import { assassinMarkStrikeBonus, selectDeathMarkTarget } from "./special-rules.js";

describe("Assassin Death Mark", () => {
  const origin = { x: 0, y: 0, z: 0 };

  it("follows aim instead of the nearest enemy", () => {
    const target = selectDeathMarkTarget(origin, 0, [
      { id: "close-offset", x: 2, y: 0, z: 2, alive: true },
      { id: "aimed", x: 0, y: 0, z: 7, alive: true },
    ]);
    expect(target?.id).toBe("aimed");
  });

  it("ignores targets behind, beyond reach, and at another depth", () => {
    expect(selectDeathMarkTarget(origin, 0, [
      { id: "behind", x: 0, y: 0, z: -2, alive: true },
      { id: "far", x: 0, y: 0, z: 9, alive: true },
      { id: "deep", x: 0, y: -4, z: 3, alive: true },
    ])).toBeNull();
  });

  it("only pays a burst on an empowered strike, capped against a boss", () => {
    const mark = { mobId: "boss", expiresAt: 100, stacks: 3 };
    expect(assassinMarkStrikeBonus(mark, "boss", 50, false, true)).toBe(0);
    expect(assassinMarkStrikeBonus(mark, "boss", 50, true, true)).toBe(1);
    expect(assassinMarkStrikeBonus(mark, "boss", 50, true, false)).toBe(2);
    expect(assassinMarkStrikeBonus(mark, "other", 50, true, false)).toBe(0);
    expect(assassinMarkStrikeBonus(mark, "boss", 100, true, false)).toBe(0);
  });
});
