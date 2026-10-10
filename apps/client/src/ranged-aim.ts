type Point = { x: number; y: number; z: number };
/** Intersect the camera ray with the shot-height plane, not changing terrain heights. */
export function rangedAimYaw(start: Point, end: Point, player: Point, fallback: number): number {
  const dy = end.y - start.y;
  if (Math.abs(dy) < .00001) return fallback;
  const t = (player.y + 1.05 - start.y) / dy;
  if (!Number.isFinite(t) || t <= 0) return fallback;
  const dx = start.x + (end.x - start.x) * t - player.x;
  const dz = start.z + (end.z - start.z) * t - player.z;
  return Math.hypot(dx, dz) < .05 ? fallback : Math.atan2(dx, dz) * 180 / Math.PI;
}
