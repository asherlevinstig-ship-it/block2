import { describe, expect, it } from "vitest";
import { HUNTERS_MARK } from "@blockcraft/protocol";
import { huntersMarkDamageBonus, huntersMarkPowerPayoff, progressHuntersMark, selectHuntersMarkTarget } from "../src/special-rules.js";

describe("Hunter's Mark", () => {
  it("selects the nearest living target inside the facing cone", () => {
    const target = selectHuntersMarkTarget({ x: 0, y: 8, z: 0 }, 0, [
      { id: "far", x: 0, y: 8, z: 7, alive: true },
      { id: "near", x: 0.8, y: 8, z: 3, alive: true },
      { id: "behind", x: 0, y: 8, z: -2, alive: true },
      { id: "dead", x: 0, y: 8, z: 1, alive: false },
    ]);
    expect(target?.id).toBe("near");
  });

  it("rejects targets outside its range or aim cone", () => {
    expect(selectHuntersMarkTarget({ x: 0, y: 8, z: 0 }, 0, [
      { id: "far", x: 0, y: 8, z: HUNTERS_MARK.range + 0.1, alive: true },
      { id: "side", x: 7, y: 8, z: 0, alive: true },
    ])).toBeNull();
  });

  it("adds damage only to the marked mob before expiry", () => {
    const mark = { mobId: "crawler", expiresAt: 7000, stacks: 1 };
    expect(huntersMarkDamageBonus(mark, "crawler", 6999)).toBe(1);
    expect(huntersMarkDamageBonus(mark, "other", 6999)).toBe(0);
    expect(huntersMarkDamageBonus(mark, "crawler", 7000)).toBe(0);
    expect(huntersMarkDamageBonus(undefined, "crawler", 100)).toBe(0);
  });

  it("builds from its initial stack to Exposed without refreshing duration", () => {
    const applied = { mobId: "crawler", expiresAt: 7000, stacks: HUNTERS_MARK.initialStacks };
    const second = progressHuntersMark(applied, "crawler", 5000)!;
    const exposed = progressHuntersMark(second, "crawler", 5100)!;
    const capped = progressHuntersMark(exposed, "crawler", 5200)!;
    expect(second).toEqual({ mobId: "crawler", expiresAt: 7000, stacks: 2 });
    expect(exposed.stacks).toBe(HUNTERS_MARK.maxStacks);
    expect(capped.stacks).toBe(HUNTERS_MARK.maxStacks);
    expect(progressHuntersMark(applied, "other", 5000)).toBeNull();
    expect(progressHuntersMark(applied, "crawler", 7000)).toBeNull();
  });

  it("lets Power consume Exposed for bonus damage and heavy stagger", () => {
    const building = { mobId: "crawler", expiresAt: 7000, stacks: 2 };
    const exposed = { ...building, stacks: HUNTERS_MARK.maxStacks };
    expect(huntersMarkPowerPayoff(building, "crawler", 6000)).toEqual({
      bonusDamage: HUNTERS_MARK.bonusDamage,
      staggerBonusMs: 0,
      consumed: false,
    });
    expect(huntersMarkPowerPayoff(exposed, "crawler", 6000)).toEqual({
      bonusDamage: HUNTERS_MARK.bonusDamage + HUNTERS_MARK.exposedPowerBonusDamage,
      staggerBonusMs: HUNTERS_MARK.exposedStaggerBonusMs,
      consumed: true,
    });
    expect(huntersMarkPowerPayoff(exposed, "crawler", 7000).consumed).toBe(false);
  });
});
