/** Cancel on blocked input; emit at most one shot per frame, never catch-up bursts. */
export function heldFireStep(held: boolean, allowed: boolean, now: number, readyAt: number) {
  return { held: held && allowed, fire: held && allowed && now >= readyAt };
}
