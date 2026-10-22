import type { ItemId } from "@blockcraft/protocol";

export type LeaderCollectionId = "greenwood" | "mistfen" | "quarry" | "northwatch" | "frontier" | "ashen";

export interface LeaderCollectionState {
  discovered: Partial<Record<LeaderCollectionId, ItemId[]>>;
  misses: Partial<Record<LeaderCollectionId, number>>;
}

type CollectionEntry = { itemId: ItemId; minRematchTier?: number };
export type LeaderCollectionDefinition = {
  id: LeaderCollectionId;
  name: string;
  leaders: readonly string[];
  items: readonly CollectionEntry[];
};

export const LEADER_COLLECTIONS: Record<LeaderCollectionId, LeaderCollectionDefinition> = {
  greenwood: { id: "greenwood", name: "Greenwood Leader Set",
    leaders: ["moss-crawler", "outskirts-crawler-a", "outskirts-crawler-b", "outskirts-crawler-c", "wild-crawler", "roaming-crawler-alpha"],
    items: [{ itemId: "forged_bow" }, { itemId: "fang_dagger" }, { itemId: "forager_wrap" }, { itemId: "rootstalker_wrap", minRematchTier: 3 }] },
  mistfen: { id: "mistfen", name: "Mistfen Leader Set",
    leaders: ["frontier-spitter", "wild-spitter-a", "wild-spitter-b", "wild-spitter-c", "gloomfang-spitter", "mistfen-behemoth", "roaming-spitter-alpha"],
    items: [{ itemId: "forged_focus" }, { itemId: "acid_gland_focus" }, { itemId: "fenwalker_mantle" }, { itemId: "mirebreaker_mantle", minRematchTier: 3 }] },
  quarry: { id: "quarry", name: "Quarry Leader Set",
    leaders: ["stone-brute", "south-quarrymaster"],
    items: [{ itemId: "stone_core_hammer" }, { itemId: "forged_sword" }, { itemId: "quarry_hauberk" }, { itemId: "bastion_plate", minRematchTier: 3 }] },
  northwatch: { id: "northwatch", name: "Northwatch Leader Set", leaders: ["northwatch-watchbreaker"],
    items: [{ itemId: "forged_bow" }, { itemId: "fang_dagger" }, { itemId: "ridgeguard_mantle" }, { itemId: "northwatch_cloak", minRematchTier: 2 }] },
  frontier: { id: "frontier", name: "Frontier Leader Set", leaders: ["frontier-brute", "frontier-brute-west", "frontier-brute-east", "roaming-brute-alpha"],
    items: [{ itemId: "stone_core_hammer" }, { itemId: "forged_sword" }, { itemId: "iron_armour" }, { itemId: "worldsplitter_plate", minRematchTier: 3 }] },
  ashen: { id: "ashen", name: "Ashen Leader Set", leaders: ["ashglass-sentry-east"],
    items: [{ itemId: "cinderfang_blade" }, { itemId: "ashguard_mantle" }, { itemId: "emberheart_focus" }, { itemId: "worldsplitter_plate", minRematchTier: 3 }] },
};

export function leaderCollectionFor(mobId: string): LeaderCollectionDefinition | null {
  return Object.values(LEADER_COLLECTIONS).find(collection => collection.leaders.includes(mobId)) ?? null;
}

export function parseLeaderCollectionState(value: unknown): LeaderCollectionState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawDiscovered = source.discovered && typeof source.discovered === "object" && !Array.isArray(source.discovered)
    ? source.discovered as Record<string, unknown> : {};
  const rawMisses = source.misses && typeof source.misses === "object" && !Array.isArray(source.misses)
    ? source.misses as Record<string, unknown> : {};
  const discovered: LeaderCollectionState["discovered"] = {};
  const misses: LeaderCollectionState["misses"] = {};
  for (const definition of Object.values(LEADER_COLLECTIONS)) {
    const valid = new Set(definition.items.map(entry => entry.itemId));
    const items = Array.isArray(rawDiscovered[definition.id])
      ? [...new Set((rawDiscovered[definition.id] as unknown[]).filter((item): item is ItemId => typeof item === "string" && valid.has(item as ItemId)))] : [];
    if (items.length) discovered[definition.id] = items;
    const miss = rawMisses[definition.id];
    if (typeof miss === "number" && Number.isFinite(miss)) misses[definition.id] = Math.max(0, Math.min(2, Math.floor(miss)));
  }
  return { discovered, misses };
}

export function resolveLeaderCollectionDrop(definition: LeaderCollectionDefinition, state: LeaderCollectionState,
  rematchTier: number, ownedOrPending: ReadonlySet<ItemId>, random: number): { itemId: ItemId; protected: boolean; nextMisses: number } {
  const eligible = definition.items.filter(entry => (entry.minRematchTier ?? 0) <= rematchTier).map(entry => entry.itemId);
  const known = new Set([...(state.discovered[definition.id] ?? []), ...ownedOrPending]);
  const missing = eligible.filter(itemId => !known.has(itemId));
  const misses = state.misses[definition.id] ?? 0;
  const protectedDrop = missing.length > 0 && (known.size === 0 || misses >= 2);
  const chooseMissing = missing.length > 0 && (protectedDrop || random < .65);
  const pool = chooseMissing ? missing : eligible;
  const normalized = Math.max(0, Math.min(.999999, Number.isFinite(random) ? random : 0));
  const itemId = pool[Math.floor(normalized * pool.length)] ?? eligible[0]!;
  return { itemId, protected: protectedDrop, nextMisses: missing.length > 0 && !chooseMissing ? Math.min(2, misses + 1) : 0 };
}

export function discoverLeaderItem(state: LeaderCollectionState, collectionId: LeaderCollectionId, itemId: ItemId): { state: LeaderCollectionState; duplicate: boolean; discovered: number; total: number } {
  const previous = state.discovered[collectionId] ?? [];
  const duplicate = previous.includes(itemId);
  const next = duplicate ? previous : [...previous, itemId];
  return { state: { discovered: { ...state.discovered, [collectionId]: next }, misses: { ...state.misses } },
    duplicate, discovered: next.length, total: LEADER_COLLECTIONS[collectionId].items.length };
}
