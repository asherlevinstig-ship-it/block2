import { LOOT_HOLD_MS } from "./loot-hold.js";
export interface PortalHold {
  portalId: string;
  startedAt: number;
  source: "keyboard" | "touch";
  pointerId?: number;
}
export function portalHoldProgress(hold: PortalHold | null, now: number, reachablePortalId: string | null): number {
  if (!hold || hold.portalId !== reachablePortalId || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.min(1, (now - hold.startedAt) / LOOT_HOLD_MS));
}
