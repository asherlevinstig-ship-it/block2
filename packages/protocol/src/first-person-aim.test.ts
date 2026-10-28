import { describe, expect, it } from "vitest";
import { AttackRequestSchema, aimedWeaponFlight, attackBodyIntersection, FIRST_PERSON_AIM_MAX, FIRST_PERSON_AIM_MIN } from "./index.js";

describe("bounded first-person attack direction", () => {
  it("only targets bodies actually crossed by the aimed ray", () => {
    const { origin, end } = aimedWeaponFlight({ x: 0, y: 8, z: 0 }, 90, Math.atan2(9.55 + .72 - 9.48, 3), 4.6);
    expect(attackBodyIntersection(origin, end, { x: 3, y: 9.55, z: 0 })).not.toBeNull();
    expect(attackBodyIntersection(origin, end, { x: 3, y: 9.55, z: .5 })).toBeNull();
    expect(attackBodyIntersection(origin, end, { x: 3, y: 6.5, z: 0 })).toBeNull();
  });
  it.each([FIRST_PERSON_AIM_MIN, 0, FIRST_PERSON_AIM_MAX])("keeps the real 3D flight within weapon range at elevation %s", elevation => {
    const { origin, end } = aimedWeaponFlight({ x: 10, y: 8, z: 12 }, 45, elevation, 4.6);
    expect(Math.hypot(end.x - origin.x, end.y - origin.y, end.z - origin.z)).toBeCloseTo(4.6);
  });
  it("accepts old packets and rejects invalid or excessive elevations", () => {
    expect(AttackRequestSchema.safeParse({ requestId: "old", yaw: 90 }).success).toBe(true);
    for (const elevation of [NaN, Infinity, -Infinity, Math.PI, -Math.PI])
      expect(AttackRequestSchema.safeParse({ requestId: "bad", yaw: 90, elevation }).success).toBe(false);
  });
});
