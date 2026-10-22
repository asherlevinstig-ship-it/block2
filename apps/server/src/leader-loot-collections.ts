import { REGIONAL_LEADER_COLLECTIONS, type ItemId, type RegionalLeaderCollectionId } from "@blockcraft/protocol";

export type LeaderCollectionId = RegionalLeaderCollectionId;

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
  greenwood: { id: "greenwood", ...REGIONAL_LEADER_COLLECTIONS.greenwood,
    leaders: ["moss-crawler", "outskirts-crawler-a", "outskirts-crawler-b", "outskirts-crawler-c", "wild-crawler", "roaming-crawler-alpha"],
  },
  mistfen: { id: "mistfen", ...REGIONAL_LEADER_COLLECTIONS.mistfen,
    leaders: ["frontier-spitter", "wild-spitter-a", "wild-spitter-b", "wild-spitter-c", "gloomfang-spitter", "mistfen-behemoth", "roaming-spitter-alpha"],
  },
  quarry: { id: "quarry", ...REGIONAL_LEADER_COLLECTIONS.quarry,
    leaders: ["stone-brute", "south-quarrymaster"],
  },
  northwatch: { id: "northwatch", ...REGIONAL_LEADER_COLLECTIONS.northwatch, leaders: ["northwatch-watchbreaker"] },
  frontier: { id: "frontier", ...REGIONAL_LEADER_COLLECTIONS.frontier, leaders: ["frontier-brute", "frontier-brute-west", "frontier-brute-east", "roaming-brute-alpha"] },
  ashen: { id: "ashen", ...REGIONAL_LEADER_COLLECTIONS.ashen, leaders: ["ashglass-sentry-east"] },
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
