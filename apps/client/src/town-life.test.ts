import { describe, expect, it } from "vitest";
import { SPEED_LAB_TOWN_ACTORS, SPEED_LAB_TOWN_LIGHTS, SPEED_LAB_TOWN_SIGNS, townLifeActorPose,
  townLifeAnimation } from "./town-life.js";

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
    expect(townLifeActorPose(smith, 8)).toMatchObject({ x: smith.route[0]![0], z: smith.route[0]![1], moving: false });
  });

  it("keeps every walking route clear of the central well", () => {
    for (const actor of SPEED_LAB_TOWN_ACTORS.filter(candidate => candidate.moveSpeed > 0)) {
      for (let index = 0; index < actor.route.length - 1; index++) {
        const from = actor.route[index]!;
        const to = actor.route[index + 1]!;
        for (let step = 0; step <= 20; step++) {
          const progress = step / 20;
          const x = from[0] + (to[0] - from[0]) * progress;
          const z = from[1] + (to[1] - from[1]) * progress;
          expect(Math.hypot(x - 67, z - 106)).toBeGreaterThan(4.5);
        }
      }
    }
  });

  it("pauses to turn, plants its feet, and never teleports at the route loop", () => {
    const guard = SPEED_LAB_TOWN_ACTORS.find(actor => actor.role === "guard")!;
    const samples = Array.from({ length: 800 }, (_, index) => townLifeActorPose(guard, index * .05));
    expect(samples.some(pose => pose.motion === "idle" && Math.abs(pose.turn) > .1)).toBe(true);
    for (let index = 1; index < samples.length; index++) {
      expect(Math.hypot(samples[index]!.x - samples[index - 1]!.x, samples[index]!.z - samples[index - 1]!.z)).toBeLessThan(.12);
    }
  });

  it("selects role-specific work animations instead of one universal gesture", () => {
    for (const role of ["vendor", "smith", "healer"] as const) {
      const actor = SPEED_LAB_TOWN_ACTORS.find(candidate => candidate.role === role)!;
      const workPose = Array.from({ length: 200 }, (_, index) => townLifeActorPose(actor, index * .1))
        .find(pose => pose.motion === "work")!;
      expect(townLifeAnimation(actor, workPose)).toMatch(role === "smith" ? /Attack_Chop/ : role === "healer" ? /Spell/ : /Interact|Cheer/);
    }
  });
});
