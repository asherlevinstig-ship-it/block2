export function hearsNearbyChat(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean {
  return Math.abs(from.y - to.y) <= 2.5 && Math.hypot(from.x - to.x, from.z - to.z) <= 24;
}
