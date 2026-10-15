import { ATTUNEMENT_DUST_YIELD, ATTUNEMENT_REROLL_COST, ATTUNEMENT_UPGRADE_COST, EQUIPMENT_AFFIXES, ITEM_DEFINITIONS,
  type BuildPathId, type EquipmentAffixId, type EquipmentAffixOffers, type EquipmentAffixRoll, type ItemId } from "@blockcraft/protocol";

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

export function rollTargetedEquipmentAffix(pathId: BuildPathId | null, tier: number, targetAffixId: EquipmentAffixId | null,
  regionMatchesTarget: boolean, random = Math.random): EquipmentAffixRoll {
  if (targetAffixId && regionMatchesTarget && random() < .45)
    return { affixId: targetAffixId, tier: Math.max(1, Math.min(3, Math.floor(tier))) as 1 | 2 | 3 };
  return rollEquipmentAffix(pathId, tier, random);
}

export function keepBetterAffix(current: EquipmentAffixRoll | undefined, candidate: EquipmentAffixRoll): EquipmentAffixRoll {
  return !current || candidate.tier > current.tier ? candidate : current;
}

export function parseEquipmentAffixOffers(value: unknown): EquipmentAffixOffers {
  const result: EquipmentAffixOffers = {};
  if (!value || typeof value !== "object") return result;
  for (const [itemId, raw] of Object.entries(value)) {
    if (!Object.hasOwn(ITEM_DEFINITIONS, itemId) || !Array.isArray(raw)) continue;
    const choices = [...new Set(raw.filter((id): id is EquipmentAffixId => typeof id === "string" && Object.hasOwn(EQUIPMENT_AFFIXES, id)))].slice(0, 3);
    if (choices.length > 0) result[itemId as ItemId] = choices;
  }
  return result;
}

export function rollEquipmentAffixOptions(pathId: BuildPathId | null, tier: number, count = 3, random = Math.random,
  guaranteedAffixId: EquipmentAffixId | null = null): EquipmentAffixRoll[] {
  const chosen: EquipmentAffixId[] = guaranteedAffixId ? [guaranteedAffixId] : [];
  for (let attempt = 0; chosen.length < count && attempt < 24; attempt++) {
    const roll = rollEquipmentAffix(pathId, tier, random);
    if (!chosen.includes(roll.affixId)) chosen.push(roll.affixId);
  }
  const fallback = pathId ? [...PATH_AFFIXES(pathId), ...AFFIX_IDS] : AFFIX_IDS;
  for (const affixId of fallback) if (chosen.length < count && !chosen.includes(affixId)) chosen.push(affixId);
  return chosen.map(affixId => ({ affixId, tier: Math.max(1, Math.min(3, Math.floor(tier))) as 1 | 2 | 3 }));
}

export function attunementDustYield(tier: number): number {
  return ATTUNEMENT_DUST_YIELD[Math.max(1, Math.min(3, Math.floor(tier))) as 1 | 2 | 3];
}

export function attunementDustCost(action: "reroll" | "upgrade", tier: number, callingDiscount = false): number {
  const normalized = Math.max(1, Math.min(3, Math.floor(tier))) as 1 | 2 | 3;
  const base = action === "reroll" ? ATTUNEMENT_REROLL_COST[normalized]
    : ATTUNEMENT_UPGRADE_COST[Math.min(2, normalized) as 1 | 2];
  return callingDiscount ? Math.max(1, Math.ceil(base * .8)) : base;
}
