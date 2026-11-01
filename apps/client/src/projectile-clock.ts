/** Align visuals with the authoritative flight. Never replay an expired shot after a late packet. */
export function projectilePresentation(releasedAt: number | undefined, offset: number, receivedAt: number, travelMs: number) {
  const durationMs = Math.max(1, travelMs);
  const startedAt = releasedAt !== undefined && Number.isFinite(releasedAt) && Number.isFinite(offset)
    ? Math.min(receivedAt, releasedAt - offset) : receivedAt;
  const progress = Math.max(0, Math.min(1, (receivedAt - startedAt) / durationMs));
  return { startedAt, durationMs, progress, expired: progress >= 1 };
}

/** Give a live projectile enough screen time to be readable. This deliberately
 * does not revive an expired network packet, but it prevents short flights (or
 * a nearby hit confirmation) from being created and removed between frames. */
export function readableProjectilePresentation(
  releasedAt: number | undefined,
  offset: number,
  receivedAt: number,
  travelMs: number,
  minimumVisibleMs: number,
) {
  const authoritative = projectilePresentation(releasedAt, offset, receivedAt, travelMs);
  if (authoritative.expired) return authoritative;
  const authoritativeRemainingMs = Math.max(1,
    authoritative.durationMs * (1 - authoritative.progress));
  return {
    ...authoritative,
    startedAt: receivedAt,
    durationMs: Math.max(authoritativeRemainingMs, minimumVisibleMs),
    progress: 0,
  };
}
