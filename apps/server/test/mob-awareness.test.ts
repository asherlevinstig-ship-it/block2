import { describe, expect, it } from "vitest";
import { awareMobTarget, createMobAwareness, MOB_MEMORY_MS, provokeMob } from "../src/mob-awareness.js";
const mob = { x: 100, y: 1, z: 100 };
const a = { ...mob, x: 105, id: "a", health: 5 };
const b = { ...mob, x: 106, id: "b", health: 5 };
describe("mob awareness", () => {
  it("responds to a ranged attacker outside passive detection range", () => {
    const state = createMobAwareness(); const attacker = { ...a, x: 110 };
    provokeMob(state, attacker, 100);
    expect(awareMobTarget(mob, [attacker], state, 133, 7, () => true)?.id).toBe("a");
    expect(awareMobTarget(mob, [attacker], state, 6200, 7, () => true)).toBeNull();
  });
  it("remembers a hit source but cannot attack a hidden attacker", () => {
    const state = createMobAwareness(); provokeMob(state, a, 100);
    expect(awareMobTarget(mob, [{ ...a, z: 103 }], state, 133, 7, () => false)).toMatchObject({ z: 100, visible: false });
  });
  it("does not acquire players through cover", () => {
    expect(awareMobTarget(mob, [a], createMobAwareness(), 0, 7, () => false)).toBeNull();
  });
  it("keeps a valid target when another player becomes closer", () => {
    const state = createMobAwareness(); awareMobTarget(mob, [a, b], state, 0, 7, () => true);
    for (let tick = 1; tick <= 100; tick++) expect(awareMobTarget(mob, [a, { ...b, x: 101 + tick % 2 }], state, tick * 33, 7, () => true)?.id).toBe("a");
  });
  it("uses a frozen last-seen position, not the hidden player's live position", () => {
    const state = createMobAwareness(); awareMobTarget(mob, [a], state, 100, 7, () => true);
    const hidden = awareMobTarget(mob, [{ ...a, z: 104 }], state, 500, 7, () => false);
    expect(hidden).toMatchObject({ x: 105, z: 100, visible: false });
    expect(awareMobTarget(mob, [a], state, 100 + MOB_MEMORY_MS, 7, () => false)).toBeNull();
  });
  it("reacquires only visible targets after memory expires", () => {
    const state = createMobAwareness(); awareMobTarget(mob, [a], state, 0, 7, () => true);
    expect(awareMobTarget(mob, [a, b], state, MOB_MEMORY_MS, 7, p => p.id === "b")?.id).toBe("b");
  });
  it("drops disconnected, dead, excluded or different-floor targets immediately", () => {
    for (const players of [[], [{ ...a, health: 0 }], [{ ...a, y: 4 }], [{ ...a, x: 111 }]]) {
      const state = createMobAwareness(); awareMobTarget(mob, [a], state, 0, 7, () => true);
      expect(awareMobTarget(mob, players, state, 100, 7, () => false)).toBeNull();
    }
  });
  it("uses a wider retention range without acquiring new targets there", () => {
    const state = createMobAwareness(); awareMobTarget(mob, [a], state, 0, 7, () => true);
    expect(awareMobTarget(mob, [{ ...a, x: 108 }], state, 33, 7, () => true)?.id).toBe("a");
    expect(awareMobTarget(mob, [{ ...a, x: 108 }], createMobAwareness(), 33, 7, () => true)).toBeNull();
  });
});
