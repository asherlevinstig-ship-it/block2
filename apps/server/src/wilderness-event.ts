export const WILDERNESS_EVENT_ID = "greenwood-venom-matriarch";
export const WILDERNESS_EVENT_POSITION = { x: 43.5, y: 8, z: 18.5 };
export const WILDERNESS_EVENT_TRACKING_RADIUS = 64;
export const WILDERNESS_EVENT_SCALING_RADIUS = 30;
export const WILDERNESS_EVENT_MAX_PLAYERS = 6;
const CAMP = ["wild-crawler", "greenwood-briar", "greenwood-briar-north"];

export function wildernessEventScale(nearbyPlayers: number): { players: number; maxHealth: number; attackDamage: number; rewardMultiplier: number } {
  const players = Math.max(1, Math.min(WILDERNESS_EVENT_MAX_PLAYERS, Math.floor(nearbyPlayers)));
  return {
    players,
    maxHealth: 24 + (players - 1) * 12,
    attackDamage: players >= 4 ? 2 : 1,
    rewardMultiplier: 1.5 + (players - 1) * .25,
  };
}
/** A fresh camp clear arms one shared encounter, not one spawn per player. */
export class WildernessEventCycle {
  private readonly defeated = new Map<string, number>();
  warningUntil = 0;
  private nextAt = 0;
  record(id: string, now: number, active: boolean): boolean {
    if (!CAMP.includes(id) || active || this.warningUntil > 0 || now < this.nextAt) return false;
    this.defeated.set(id, now);
    if (!CAMP.every(member => now - (this.defeated.get(member) ?? -Infinity) <= 60000)) return false;
    this.defeated.clear();
    this.warningUntil = now + 8000;
    this.nextAt = now + 120000;
    return true;
  }
  release(now: number): boolean {
    if (!this.warningUntil || now < this.warningUntil) return false;
    this.warningUntil = 0;
    return true;
  }
}
