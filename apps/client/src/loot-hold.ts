export const LOOT_HOLD_MS = 750;

export interface LootHold { dropId: string; startedAt: number; source: "keyboard" | "touch" }

export function lootHoldSourceForPointer(pointerType: string): LootHold["source"] | null {
  return pointerType === "touch" ? "touch" : null;
}

export function lootHoldProgress(hold: LootHold | null, now: number, dropId: string | null): number {
  if (!hold || hold.dropId !== dropId || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.min(1, (now - hold.startedAt) / LOOT_HOLD_MS));
}
