import { mobAimCommitMs } from "@blockcraft/protocol";
/** Offset against performance.now(), so client wall-clock changes cannot shift attacks. */
export interface ServerClock { offset: number; bestRtt: number; synchronized: boolean }
export const createServerClock = (localNow: number, epochNow: number): ServerClock => ({
  offset: epochNow - localNow, bestRtt: Infinity, synchronized: false,
});
export function sampleServerClock(clock: ServerClock, sentAt: number, receivedAt: number, serverTime: number): ServerClock {
  const rtt = receivedAt - sentAt;
  if (!Number.isFinite(serverTime) || !Number.isFinite(rtt) || rtt < 0 || rtt > 5000) return clock;
  // Lowest-RTT samples reduce queueing bias. Accept near-best samples for slow clock drift.
  if (clock.synchronized && rtt > clock.bestRtt + 25) return clock;
  const offset = serverTime - (sentAt + receivedAt) / 2;
  return { offset: clock.synchronized ? clock.offset + (offset - clock.offset) * 0.15 : offset,
    bestRtt: Math.min(clock.bestRtt, rtt), synchronized: true };
}

export interface EnemyTimeline {
  alive: boolean; combatState: string; aimCommitted: boolean;
  archetype?: string;
  attackStartedAt: number; attackReleaseAt: number; attackContactAt: number;
  attackContactEndAt: number; attackRecoveryEndAt: number;
}
export function enemyAttackPresentation(mob: EnemyTimeline, serverNow: number) {
  const valid = mob.alive && mob.attackStartedAt > 0
    && ["windup", "strike", "recover"].includes(mob.combatState);
  const phase = !valid ? mob.combatState : serverNow < mob.attackReleaseAt ? "windup"
    : serverNow <= mob.attackContactEndAt ? "strike"
      : serverNow < mob.attackRecoveryEndAt ? "recover" : "idle";
  return {
    phase,
    warning: mob.alive && (phase === "windup" || phase === "strike"),
    aimLocked: phase === "strike" || (phase === "windup" && (mob.aimCommitted || serverNow >= mob.attackReleaseAt - mobAimCommitMs(mob.archetype ?? ""))),
    elapsed: valid ? serverNow - mob.attackReleaseAt : -1,
    // Don't replay effects for an old attack when joining or resuming a background tab.
    impactDue: valid && serverNow >= mob.attackContactAt && serverNow <= mob.attackContactEndAt + 200,
  };
}
