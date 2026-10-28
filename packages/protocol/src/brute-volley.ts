import { mobProjectileWarningLane } from "./enemy-projectiles.js";
export const BRUTE_VOLLEY = { range: 9, attackRange: 8, minimumRange: 4, windupMs: 1500, travelMs: 1400,
  recoveryMs: 2400, cooldownMs: 3400, offsets: [-26, 0, 26], laneHalfWidth: .42 } as const;
export const bruteVolleyReady = (sequence: number, distance: number) => sequence % 2 === 0
  && distance >= BRUTE_VOLLEY.minimumRange && distance <= BRUTE_VOLLEY.attackRange;
export function bruteRockEndpoints(start: { x: number; y: number; z: number }, yaw: number) {
  return BRUTE_VOLLEY.offsets.map(offset => {
    const angle = (yaw + offset) * Math.PI / 180;
    // Mob projectile messages add .08 to targetY; end the rock at body height (.72).
    return { x: start.x + Math.sin(angle) * BRUTE_VOLLEY.range, y: start.y + .64, z: start.z + Math.cos(angle) * BRUTE_VOLLEY.range };
  });
}
export function bruteRockLanes(yaw: number, lengths?: readonly number[], fastWorld = false) {
  return BRUTE_VOLLEY.offsets.map((offset, index) => {
    const length = Math.max(0, Math.min(BRUTE_VOLLEY.range, lengths?.[index] ?? BRUTE_VOLLEY.range));
    return mobProjectileWarningLane(yaw + offset, length, BRUTE_VOLLEY.laneHalfWidth, fastWorld);
  });
}
