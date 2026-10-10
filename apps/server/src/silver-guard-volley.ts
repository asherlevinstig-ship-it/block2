import { SILVER_GUARD_IDS } from "./wilderness-encounters.js";
export const SILVER_VOLLEY_GAP_MS = 1400;
export class SilverGuardVolley {
  private nextStartAt = 0;
  canStart(id: string, now: number): boolean { return !SILVER_GUARD_IDS.some(guard => guard === id) || now >= this.nextStartAt; }
  started(id: string, now: number): void { if (SILVER_GUARD_IDS.some(guard => guard === id)) this.nextStartAt = now + SILVER_VOLLEY_GAP_MS; }
}
