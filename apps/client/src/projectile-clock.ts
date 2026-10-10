/** Align visuals with the authoritative flight. Never replay an expired shot after a late packet. */
export function projectilePresentation(releasedAt: number | undefined, offset: number, receivedAt: number, travelMs: number) {
  const durationMs = Math.max(1, travelMs);
  const startedAt = releasedAt !== undefined && Number.isFinite(releasedAt) && Number.isFinite(offset)
    ? Math.min(receivedAt, releasedAt - offset) : receivedAt;
  const progress = Math.max(0, Math.min(1, (receivedAt - startedAt) / durationMs));
  return { startedAt, durationMs, progress, expired: progress >= 1 };
}
