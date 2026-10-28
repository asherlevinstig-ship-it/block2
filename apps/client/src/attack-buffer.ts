export const ATTACK_BUFFER_WINDOW_MS = 120;
const BUFFER_GRACE_MS = 180;

/** One deliberate follow-up near recovery's end, never a backlog of attacks. */
export class AttackBuffer<T> {
  private queued: { input: T; weapon: string; expiresAt: number } | null = null;
  offer(input: T, weapon: string, now: number, readyAt: number): boolean {
    if (this.queued || !Number.isFinite(readyAt) || readyAt <= now || readyAt - now > ATTACK_BUFFER_WINDOW_MS) return false;
    this.queued = { input, weapon, expiresAt: readyAt + BUFFER_GRACE_MS };
    return true;
  }
  take(weapon: string, now: number, readyAt: number, allowed: boolean): T | null {
    const queued = this.queued;
    if (!queued) return null;
    if (!allowed || queued.weapon !== weapon || now > queued.expiresAt) { this.clear(); return null; }
    if (now < readyAt) return null;
    this.clear();
    return queued.input;
  }
  hasQueued(): boolean { return this.queued !== null; }
  clear(): void { this.queued = null; }
}

export function attackReadiness(now: number, startedAt: number | null, duration: number, impact: number, queued: boolean) {
  const elapsed = startedAt === null ? duration : Math.max(0, now - startedAt);
  const progress = Math.min(1, elapsed / Math.max(1, duration));
  return { progress, label: queued ? "NEXT QUEUED" : progress >= 1 ? "READY" : elapsed < impact ? "SWING" : "RECOVERING" };
}

export type AttackOutcome = "hit" | "defeated" | "miss" | "blocked";
export function attackOutcomeAllowed(previous: { kind: AttackOutcome; at: number } | null, next: AttackOutcome, now: number): boolean {
  if (next === "hit" || next === "defeated" || !previous) return true;
  if ((previous.kind === "hit" || previous.kind === "defeated") && now - previous.at < 200) return false;
  return !(previous.kind === "blocked" && next === "miss" && now - previous.at < 100);
}
