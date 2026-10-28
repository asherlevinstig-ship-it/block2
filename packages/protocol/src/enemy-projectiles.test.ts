import { describe, expect, it } from "vitest";
import { BRUTE_VOLLEY, bruteRockEndpoints, fastWorldProjectileFan, mobVolleyOffsets,
  spitterShotEndpoints, spitterWarningLanes, SPITTER_PATTERN } from "./index.js";

describe("readable Fast World volleys", () => {
  it.each(["fan", "venom-ring", "crystal-burst"])("preserves the authored gaps in %s", pattern => {
    const shots = spitterShotEndpoints({ x: 0, y: 0, z: 0 }, 0, pattern);
    expect(fastWorldProjectileFan({ x: 0, z: 0 }, shots, true)).toEqual(shots);
    expect(spitterWarningLanes(0, pattern, undefined, true)).toHaveLength(shots.length);
  });
  it("keeps the three rock lanes instead of silently firing nine", () => {
    const shots = bruteRockEndpoints({ x: 0, y: 0, z: 0 }, 0);
    expect(fastWorldProjectileFan({ x: 0, z: 0 }, shots, true)).toHaveLength(BRUTE_VOLLEY.offsets.length);
  });
  it("shows every projectile in an aimed three-shot spread", () => {
    const shots = fastWorldProjectileFan({ x: 0, z: 0 }, spitterShotEndpoints({ x: 0, y: 0, z: 0 }, 37, "aimed"), true);
    const offsets = mobVolleyOffsets([0], SPITTER_PATTERN.range, true);
    expect(spitterWarningLanes(37, "aimed", undefined, true)).toHaveLength(shots.length);
    shots.forEach((shot, i) => expect(Math.atan2(shot.x, shot.z) * 180 / Math.PI).toBeCloseTo(37 + offsets[i]!));
  });
});
