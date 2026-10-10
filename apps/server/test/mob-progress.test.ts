import { describe, expect, it } from "vitest";
import { checkMobProgress, type MobProgress } from "../src/mob-progress.js";
const pose = { x: 100, y: 1, z: 100 };
describe("mob stuck recovery", () => {
  it("retries once after 1.2 seconds and abandons after sustained failure", () => {
    let state: MobProgress | undefined; const actions: string[] = [];
    for (let now = 0; now <= 4500; now += 100) {
      const result = checkMobProgress(state, pose, pose, now, true); state = result.state;
      if (result.action !== "none") actions.push(`${now}:${result.action}`);
    }
    expect(actions).toEqual(["1200:replan", "4500:abandon"]);
  });
  it("resets on meaningful real movement even along a detour", () => {
    const state = { anchor: pose, since: 0, sampledAt: 4400, retried: true };
    const result = checkMobProgress(state, pose, { ...pose, z: 100.2 }, 4500, true);
    expect(result.action).toBe("none"); expect(result.state?.since).toBe(4500);
  });
  it("does not count deliberate waiting, combat pauses or suspended simulation", () => {
    const state = { anchor: pose, since: 0, sampledAt: 100, retried: false };
    expect(checkMobProgress(state, pose, pose, 200, false).state).toBeUndefined();
    expect(checkMobProgress(state, pose, pose, 10000, true).action).toBe("none");
    expect(checkMobProgress(state, pose, pose, 0, true).action).toBe("none");
  });
});
