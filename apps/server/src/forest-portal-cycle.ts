import { SILVER_GUARD_IDS } from "./wilderness-encounters.js";
/** Both kills must be fresh; respawning guards do not make the pair impossible to clear. */
export class ForestPortalCycle {
  private readonly kills = new Map<string, number>();
  record(id: string, now: number): boolean {
    if (!SILVER_GUARD_IDS.some(guard => guard === id)) return false;
    this.kills.set(id, now);
    if (!SILVER_GUARD_IDS.every(guard => now - (this.kills.get(guard) ?? -Infinity) <= 60_000)) return false;
    this.kills.clear(); return true;
  }
}
