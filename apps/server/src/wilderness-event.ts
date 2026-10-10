export const WILDERNESS_EVENT_ID = "greenwood-venom-matriarch";
export const WILDERNESS_EVENT_POSITION = { x: 43.5, y: 8, z: 18.5 };
const CAMP = ["wild-crawler", "greenwood-briar", "greenwood-briar-north"];
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
