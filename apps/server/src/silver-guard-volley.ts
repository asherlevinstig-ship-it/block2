import { SILVER_GUARD_IDS } from "./wilderness-encounters.js";
export const SILVER_VOLLEY_GAP_MS = 1400;
export class SilverGuardVolley {
  private nextReleaseAt = 0;
  canStart(id: string, now: number, releaseAt = now): boolean {
    return !SILVER_GUARD_IDS.some(guard => guard === id) || releaseAt >= this.nextReleaseAt;
  }
  started(id: string, releaseAt: number): void {
    if (SILVER_GUARD_IDS.some(guard => guard === id)) this.nextReleaseAt = releaseAt + SILVER_VOLLEY_GAP_MS;
  }
}
