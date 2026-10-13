export const DODGE_REQUEST_INTERVAL_MS = 350;

/** Keep client prediction inside the authoritative dodge rate limit. */
export function canRequestPredictedDodge(
  now: number,
  previousRequestAt: number,
  intervalMs = DODGE_REQUEST_INTERVAL_MS,
): boolean {
  return Number.isFinite(now) && now - previousRequestAt >= intervalMs;
}
