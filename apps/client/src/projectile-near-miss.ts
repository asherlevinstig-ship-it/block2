type Point = { x: number; y: number; z: number };
/** Presentation only: detect a passing shot, never grant damage immunity or rewards. */
export function projectileNearMiss(from: Point, to: Point, player: Point): Point | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  // Suppress frozen shots and large catch-up jumps after late packets/frame stalls.
  if (!Number.isFinite(length) || length < .001 || length > .9) return null;
  const t = Math.max(0, Math.min(1, ((player.x - from.x) * dx + (player.z - from.z) * dz) / (length * length)));
  const point = { x: from.x + dx * t, y: from.y + (to.y - from.y) * t, z: from.z + dz * t };
  const clearance = Math.hypot(point.x - player.x, point.z - player.z);
  // A generous exclusion around the body ensures actual contact is not called a dodge.
  if (clearance < .78 || clearance > 1.3 || point.y < player.y + .05 || point.y > player.y + 1.4) return null;
  // Wait until it is moving away, rather than celebrating an approaching projectile.
  if (((to.x - player.x) * dx + (to.z - player.z) * dz) / length < .05) return null;
  return point;
}
