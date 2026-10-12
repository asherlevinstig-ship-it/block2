import { BLACKSMITH_REFORGE, type BlacksmithReforgeItemId, type EquipmentReforgeRanks } from "@blockcraft/protocol";

export function parseReforgeRanks(value: unknown): EquipmentReforgeRanks {
  let source: unknown = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { return {}; }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const ranks: EquipmentReforgeRanks = {};
  for (const itemId of Object.keys(BLACKSMITH_REFORGE) as BlacksmithReforgeItemId[]) {
    const rank = (source as Record<string, unknown>)[itemId];
    if (typeof rank === "number" && Number.isInteger(rank) && rank > 0) ranks[itemId] = Math.min(3, rank);
  }
  return ranks;
}

export function serializeReforgeRanks(ranks: EquipmentReforgeRanks): string {
  return JSON.stringify(parseReforgeRanks(ranks));
}

export function equipmentReforgeRank(serialized: string, itemId: string): number {
  if (!Object.hasOwn(BLACKSMITH_REFORGE, itemId)) return 0;
  return parseReforgeRanks(serialized)[itemId as BlacksmithReforgeItemId] ?? 0;
}

export function withReforgeRank(serialized: string, itemId: BlacksmithReforgeItemId, rank: number): string {
  const ranks = parseReforgeRanks(serialized);
  ranks[itemId] = Math.max(0, Math.min(3, Math.floor(rank)));
  return serializeReforgeRanks(ranks);
}
