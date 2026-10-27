/** Convert authoritative expiry to a bounded monotonic deadline. A damage
 * update must not prolong a lock; an applied update can authoritatively refresh it. */
export function thornBindingDeadline(expiresAt: number, serverNow: number, localNow: number,
  previousDeadline: number, sameBinding: boolean): number {
  if (!Number.isFinite(expiresAt) || !Number.isFinite(serverNow)) return 0;
  const remaining = Math.max(0, Math.min(3_500, expiresAt - serverNow));
  const deadline = localNow + remaining;
  return sameBinding ? Math.min(previousDeadline, deadline) : deadline;
}
