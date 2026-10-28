export const ENEMY_PROJECTILE_RADIUS = .15;
export const FAST_WORLD_SINGLE_SHOT_SPREAD = .72;

/** Include the world-aligned player/core boxes even on diagonal shot lanes. */
export function mobProjectileWarningLane(yaw: number, length: number, legacyHalfWidth: number, fastWorld: boolean) {
  const a = yaw * Math.PI / 180, dx = Math.sin(a), dz = Math.cos(a);
  const margin = (.38 + ENEMY_PROJECTILE_RADIUS) * (Math.abs(dx) + Math.abs(dz)) + .02;
  const width = fastWorld ? margin : legacyHalfWidth, back = fastWorld ? -margin : 0;
  const front = length + (fastWorld ? margin : 0);
  return [{ x: dx * back + dz * width, z: dz * back - dx * width },
    { x: dx * back - dz * width, z: dz * back + dx * width },
    { x: dx * front - dz * width, z: dz * front + dx * width },
    { x: dx * front + dz * width, z: dz * front - dx * width }];
}

/** Authored fans/rings keep their deliberate gaps; only an aimed shot becomes a spread. */
export function fastWorldProjectileFan<T extends { x: number; y: number; z: number }>(
  origin: { x: number; z: number }, shots: readonly T[], enabled: boolean): T[] {
  if (!enabled || shots.length !== 1) return [...shots];
  const shot = shots[0]!, dx = shot.x - origin.x, dz = shot.z - origin.z;
  const length = Math.max(.001, Math.hypot(dx, dz));
  const sideX = -dz / length * FAST_WORLD_SINGLE_SHOT_SPREAD, sideZ = dx / length * FAST_WORLD_SINGLE_SHOT_SPREAD;
  return [{ ...shot, x: shot.x + sideX, z: shot.z + sideZ }, shot, { ...shot, x: shot.x - sideX, z: shot.z - sideZ }];
}

export function mobVolleyOffsets(offsets: readonly number[], range: number, enabled: boolean): readonly number[] {
  if (!enabled || offsets.length !== 1) return offsets;
  const spread = Math.atan2(FAST_WORLD_SINGLE_SHOT_SPREAD, range) * 180 / Math.PI;
  return [offsets[0]! - spread, offsets[0]!, offsets[0]! + spread];
}
