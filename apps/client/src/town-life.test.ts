import { describe, expect, it } from "vitest";
import { SPEED_LAB_TOWN_ACTORS, SPEED_LAB_TOWN_LIGHTS, SPEED_LAB_TOWN_SIGNS, townLifeActorPose } from "./town-life.js";

describe("speed-lab town life", () => {
  it("gives every major destination a sign and warm square lighting", () => {
    expect(new Set(SPEED_LAB_TOWN_SIGNS.map(sign => sign.kind))).toEqual(
      new Set(["hall", "inn", "smith", "weaver", "healer", "barracks"]),
    );
    expect(SPEED_LAB_TOWN_LIGHTS).toHaveLength(4);
  });

  it("populates civic, service and ambient roles without network entities", () => {
    const roles = new Set(SPEED_LAB_TOWN_ACTORS.map(actor => actor.role));
    expect(roles).toEqual(new Set(["guard", "vendor", "smith", "healer", "resident"]));
    expect(SPEED_LAB_TOWN_ACTORS.filter(actor => actor.role === "guard")).toHaveLength(2);
  });

  it("moves patrols smoothly and keeps workers at their stations", () => {
    const guard = SPEED_LAB_TOWN_ACTORS.find(actor => actor.role === "guard")!;
    const start = townLifeActorPose(guard, 0);
    const later = townLifeActorPose(guard, 4);
    expect(later.moving).toBe(true);
    expect(later.x).not.toBe(start.x);
    const smith = SPEED_LAB_TOWN_ACTORS.find(actor => actor.role === "smith")!;
    expect(townLifeActorPose(smith, 8)).toMatchObject({ x: smith.start[0], z: smith.start[1], moving: false });
  });

  it("keeps every walking route clear of the central well", () => {
    for (const actor of SPEED_LAB_TOWN_ACTORS.filter(candidate => candidate.speed > 0)) {
      const midpointX = (actor.start[0] + actor.end[0]) / 2;
      const midpointZ = (actor.start[1] + actor.end[1]) / 2;
      expect(Math.hypot(midpointX - 67, midpointZ - 106)).toBeGreaterThan(4.5);
    }
  });
});
