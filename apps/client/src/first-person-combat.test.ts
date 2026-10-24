import { describe, expect, it } from "vitest";
import { firstPersonImpactImpulse, selectFirstPersonAimTarget } from "./first-person-combat.js";

describe("first-person combat", () => {
  it("selects the visible target closest to the crosshair rather than the nearest off-axis mob", () => {
    const selected = selectFirstPersonAimTarget({ x: 0, z: 0 }, 0, 12, 90, [
      { id: "near-off-axis", x: 2, z: 2, visible: true, screenDistance: 84 },
      { id: "crosshair", x: .1, z: 7, visible: true, screenDistance: 8 },
    ]);
    expect(selected?.id).toBe("crosshair");
  });

  it("rejects hidden, off-screen, out-of-cone, and out-of-range targets", () => {
    expect(selectFirstPersonAimTarget({ x: 0, z: 0 }, 0, 5, 80, [
      { id: "hidden", x: 0, z: 2, visible: false, screenDistance: 0 },
      { id: "off-screen", x: 0, z: 2, visible: true, screenDistance: 120 },
      { id: "off-axis", x: 2, z: 0, visible: true, screenDistance: 10 },
      { id: "far", x: 0, z: 8, visible: true, screenDistance: 2 },
    ])).toBeNull();
  });

  it("gives heavy finishers a stronger, longer but still restrained impact", () => {
    const sword = firstPersonImpactImpulse("sword", 1, false);
    const hammerFinisher = firstPersonImpactImpulse("hammer", 3, true);
    expect(hammerFinisher.strength).toBeGreaterThan(sword.strength);
    expect(hammerFinisher.durationMs).toBeGreaterThan(sword.durationMs);
    expect(hammerFinisher.strength).toBeLessThanOrEqual(.1);
  });
});
