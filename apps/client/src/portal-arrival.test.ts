import { describe, expect, it } from "vitest";
import { RAPID_PRACTICE_ARENA, TOWER_FLOOR_ONE, FAST_WORLD_COLLISION_QUERY } from "@blockcraft/protocol";
import { towerPortalArrival, portalArrivalOrbit } from "./portal-arrival.js";
import { firstPersonLookDirection, FIRST_PERSON_NEUTRAL_ORBIT_PITCH } from "./camera-view.js";
import { initialCameraOrbit, cameraOrbitOffset } from "./camera-orbit.js";

describe("authored tower portal arrivals", () => {
  it("faces Floor 1's causeway, away from the return portal", () => {
    const arrival = towerPortalArrival(TOWER_FLOOR_ONE.entry)!;
    const look = firstPersonLookDirection(arrival.cameraYaw, FIRST_PERSON_NEUTRAL_ORBIT_PITCH);
    expect(arrival.title).toContain("Floor 1");
    expect(look.x).toBeCloseTo(1);
    expect(look.z).toBeCloseTo(0);
    expect(cameraOrbitOffset(portalArrivalOrbit(initialCameraOrbit(), arrival, "third-person")).x).toBeLessThan(0);
  });
  it("faces the plaza on return, rather than the tower portal", () => {
    const arrival = towerPortalArrival(RAPID_PRACTICE_ARENA.spawn)!;
    const look = firstPersonLookDirection(arrival.cameraYaw, FIRST_PERSON_NEUTRAL_ORBIT_PITCH);
    expect(arrival.title).toBe("Town of Beginnings");
    expect(look.x).toBeLessThan(-.99);
  });
  it("resets spin and tilt while preserving the player's zoom", () => {
    const orbit = { ...initialCameraOrbit(35), yawSpeed: 2, pitchSpeed: 1, pitch: 1.5 };
    const next = portalArrivalOrbit(orbit, towerPortalArrival(TOWER_FLOOR_ONE.entry)!, "first-person");
    expect(next).toMatchObject({ distance: 35, yawSpeed: 0, pitchSpeed: 0, pitch: FIRST_PERSON_NEUTRAL_ORBIT_PITCH });
    expect(towerPortalArrival({ x: 160, y: -4, z: 165 })).toBeNull();
  });
  it("keeps the authored forward routes clear of building and fortress walls", () => {
    for (const start of [TOWER_FLOOR_ONE.entry, RAPID_PRACTICE_ARENA.spawn]) {
      const arrival = towerPortalArrival(start)!;
      const look = firstPersonLookDirection(arrival.cameraYaw, FIRST_PERSON_NEUTRAL_ORBIT_PITCH);
      for (let distance = 1; distance <= 12; distance++) {
        expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(start.x + look.x * distance, start.y + 1, start.z + look.z * distance)).toBeNull();
      }
    }
  });
});
