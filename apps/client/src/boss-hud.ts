type Pose = { x: number; y: number; z: number };
export type BossHudMob = Pose & { name: string; alive: boolean; health: number; maxHealth: number; enraged?: boolean };
export interface BossHudState { visible: boolean; alive?: boolean; enraged: boolean; message: string; messageUntil: number }
export const initialBossHud = (): BossHudState => ({ visible: false, enraged: false, message: "", messageUntil: 0 });
export interface BossHudCopy { arrival: string; enrage: string; defeat: string }
export function bossHudCopy(name: string): BossHudCopy {
  if (/Root Guardian/i.test(name)) return {
    arrival: "ANCIENT ROOT GUARDIAN AWAKENS",
    enrage: "THE HEARTWOOD BREAKS · CHARGE INCOMING",
    defeat: "ROOT GUARDIAN DEFEATED · CLAIM YOUR REWARD",
  };
  return {
    arrival: "VENOM MATRIARCH HAS ARRIVED",
    enrage: "ENRAGED · WATCH FOR THE DOUBLE VOLLEY",
    defeat: "MATRIARCH DEFEATED · COLLECT YOUR LOOT",
  };
}
/** Track transitions, not frames, so notices never replay every update or re-entry. */
export function advanceBossHud(previous: BossHudState, boss: BossHudMob | undefined, player: Pose & { health: number }, now: number): BossHudState {
  if (!boss || player.health <= 0) return initialBossHud();
  const nearby = Math.abs(player.y - boss.y) <= 2.5 && Math.hypot(player.x - boss.x, player.z - boss.z) <= (previous.visible ? 28 : 24);
  const copy = bossHudCopy(boss.name);
  let message = previous.message, messageUntil = previous.messageUntil;
  if (!nearby) { message = ""; messageUntil = 0; }
  else if (boss.alive && previous.alive !== true) { message = copy.arrival; messageUntil = now + 3000; }
  else if (boss.alive && boss.enraged && !previous.enraged) { message = copy.enrage; messageUntil = now + 3000; }
  else if (!boss.alive && previous.alive === true && previous.visible) { message = copy.defeat; messageUntil = now + 3500; }
  if (now >= messageUntil) message = "";
  return { visible: nearby && (boss.alive || message !== ""), alive: boss.alive, enraged: boss.enraged === true, message, messageUntil };
}
