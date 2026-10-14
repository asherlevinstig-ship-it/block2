import { EQUIPMENT_AFFIXES, ITEM_DEFINITIONS, type BuildPathId, type EquipmentAffixId, type EquipmentAffixRoll, type ItemId } from "@blockcraft/protocol";

const AFFIX_IDS = Object.keys(EQUIPMENT_AFFIXES) as EquipmentAffixId[];
const PATH_AFFIXES = (pathId: BuildPathId): EquipmentAffixId[] => AFFIX_IDS.filter(id => EQUIPMENT_AFFIXES[id].pathId === pathId);

export function parseEquipmentAffixes(value: unknown): Partial<Record<ItemId, EquipmentAffixRoll>> {
  const result: Partial<Record<ItemId, EquipmentAffixRoll>> = {};
  if (!value || typeof value !== "object") return result;
  for (const [itemId, raw] of Object.entries(value)) {
    if (!Object.hasOwn(ITEM_DEFINITIONS, itemId) || !raw || typeof raw !== "object") continue;
    const roll = raw as { affixId?: unknown; tier?: unknown };
    if (typeof roll.affixId !== "string" || !Object.hasOwn(EQUIPMENT_AFFIXES, roll.affixId)
      || typeof roll.tier !== "number" || ![1, 2, 3].includes(roll.tier)) continue;
    result[itemId as ItemId] = { affixId: roll.affixId as EquipmentAffixId, tier: roll.tier as 1 | 2 | 3 };
  }
  return result;
}

export function rollEquipmentAffix(pathId: BuildPathId | null, tier: number, random = Math.random): EquipmentAffixRoll {
  const pool = pathId && random() < .7 ? PATH_AFFIXES(pathId) : AFFIX_IDS;
  return { affixId: pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!, tier: Math.max(1, Math.min(3, Math.floor(tier))) as 1 | 2 | 3 };
}

export function keepBetterAffix(current: EquipmentAffixRoll | undefined, candidate: EquipmentAffixRoll): EquipmentAffixRoll {
  return !current || candidate.tier > current.tier ? candidate : current;
}
