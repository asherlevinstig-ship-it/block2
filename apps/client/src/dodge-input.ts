export const DODGE_REQUEST_INTERVAL_MS = 350;

export interface DodgeVisualOffset {
  x: number;
  z: number;
}

/** Keep client prediction inside the authoritative dodge rate limit. */
export function canRequestPredictedDodge(
  now: number,
  previousRequestAt: number,
  intervalMs = DODGE_REQUEST_INTERVAL_MS,
): boolean {
  return Number.isFinite(now) && now - previousRequestAt >= intervalMs;
}

/** Keep the rendered player at the pre-dodge location, then glide to prediction. */
export function beginDodgeVisualOffset(
  offset: DodgeVisualOffset,
  from: DodgeVisualOffset,
  to: DodgeVisualOffset,
): DodgeVisualOffset {
  return { x: offset.x + from.x - to.x, z: offset.z + from.z - to.z };
}

/** Bound dodge presentation speed so low frame rates cannot produce a 1.8 m camera jump. */
export function advanceDodgeVisualOffset(
  offset: DodgeVisualOffset,
  deltaTime: number,
): DodgeVisualOffset {
  const length = Math.hypot(offset.x, offset.z);
  if (length < 0.001) return { x: 0, z: 0 };
  const dt = Math.max(0, Math.min(deltaTime, 0.05));
  const travel = Math.min(length * (1 - Math.exp(-14 * dt)), 8 * dt);
  const fraction = 1 - travel / length;
  return { x: offset.x * fraction, z: offset.z * fraction };
}

/** Do not reconcile against a snapshot that predates the predicted dodge. */
export function dodgeReconciliationPending(
  now: number,
  requestedAt: number,
  roundTripMs: number | null,
): boolean {
  if (!Number.isFinite(requestedAt)) return false;
  const confirmationWindow = Math.min(1_400, Math.max(450, (roundTripMs ?? 225) * 2));
  return now - requestedAt < confirmationWindow;
}
