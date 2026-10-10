/** Slow, shortest-arc windup tracking. Commitment freezes this on the server. */
export function turnBruteAim(yaw: number, desired: number, dt: number): number {
  const angle = ((desired - yaw) % 360 + 540) % 360 - 180;
  const limit = 120 * Math.max(0, Math.min(.1, dt));
  return yaw + Math.sign(angle) * Math.min(Math.abs(angle), limit);
}
