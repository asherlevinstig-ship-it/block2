/** Only a small, server-bounded part of transport delay may count toward an action. */
export const MAX_COMBAT_LAG_COMPENSATION_MS = 100;

export function compensatedActionAt(receivedAt: number, claimedAt: number | undefined): number {
  if (claimedAt === undefined || !Number.isFinite(claimedAt)) return receivedAt;
  if (claimedAt > receivedAt + 25) return receivedAt;
  return Math.max(receivedAt - MAX_COMBAT_LAG_COMPENSATION_MS, Math.min(receivedAt, claimedAt));
}
