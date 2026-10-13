import { ITEM_DEFINITIONS, ITEM_RARITIES, itemRarity, type ItemId } from "@blockcraft/protocol";

export type SignatureItemId = Extract<ItemId,
  "matriarch_edge" | "venom_focus" | "stone_core_hammer" | "echo_prism" | "rootbound_hammer" | "rootguard_armour">;
export type SignaturePity = Partial<Record<SignatureItemId, number>>;

export const SIGNATURE_DROP_RULES: Record<SignatureItemId, { chance: number; guaranteedBy: number; source: string }> = {
  matriarch_edge: { chance: .25, guaranteedBy: 4, source: "Crystal Matriarch" },
  venom_focus: { chance: .2, guaranteedBy: 5, source: "Venom Matriarch" },
  stone_core_hammer: { chance: .3, guaranteedBy: 4, source: "Stoneheart Siege Lord" },
  echo_prism: { chance: .25, guaranteedBy: 4, source: "Ashglass Oracle" },
  rootbound_hammer: { chance: .25, guaranteedBy: 4, source: "Realm Stone Warden" },
  rootguard_armour: { chance: .25, guaranteedBy: 4, source: "Realm Stone Warden" },
};

export type SignatureDropResult = {
  drop: boolean;
  firstClear: boolean;
  pityTriggered: boolean;
  nextMisses: number;
  chancePercent: number;
  guaranteedIn: number;
};

export function parseSignaturePity(value: unknown): SignaturePity {
  if (typeof value === "string") {
    try { return parseSignaturePity(JSON.parse(value)); } catch { return {}; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const result: SignaturePity = {};
  for (const itemId of Object.keys(SIGNATURE_DROP_RULES) as SignatureItemId[]) {
    const misses = record[itemId];
    if (typeof misses === "number" && Number.isInteger(misses) && misses > 0) {
      result[itemId] = Math.min(SIGNATURE_DROP_RULES[itemId].guaranteedBy - 1, misses);
    }
  }
  return result;
}

export function serializeSignaturePity(pity: SignaturePity): string {
  return JSON.stringify(parseSignaturePity(pity));
}

export function resolveSignatureDrop(itemId: SignatureItemId, ownsItem: boolean, misses: number, roll: number): SignatureDropResult {
  const rule = SIGNATURE_DROP_RULES[itemId];
  const safeMisses = Math.min(rule.guaranteedBy - 1, Math.max(0, Math.floor(misses)));
  const firstClear = !ownsItem;
  const pityTriggered = ownsItem && safeMisses + 1 >= rule.guaranteedBy;
  const drop = firstClear || pityTriggered || roll < rule.chance;
  const nextMisses = drop ? 0 : safeMisses + 1;
  return {
    drop,
    firstClear,
    pityTriggered,
    nextMisses,
    chancePercent: Math.round(rule.chance * 100),
    guaranteedIn: drop ? rule.guaranteedBy : Math.max(1, rule.guaranteedBy - nextMisses),
  };
}

export function signatureLootHint(itemId: SignatureItemId, ownsItem: boolean, pity: SignaturePity): string {
  const rule = SIGNATURE_DROP_RULES[itemId];
  const rarity = ITEM_RARITIES[itemRarity(itemId)].label.toUpperCase();
  if (!ownsItem) return `${rarity} · First victory guarantees ${ITEM_DEFINITIONS[itemId].name}`;
  const misses = pity[itemId] ?? 0;
  const remaining = Math.max(1, rule.guaranteedBy - misses);
  return `${ITEM_DEFINITIONS[itemId].name} · ${Math.round(rule.chance * 100)}% · guaranteed within ${remaining} clear${remaining === 1 ? "" : "s"}`;
}
