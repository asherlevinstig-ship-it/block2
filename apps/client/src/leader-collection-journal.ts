import { REGIONAL_LEADER_COLLECTIONS, type ItemId, type RegionalLeaderCollectionId } from "@blockcraft/protocol";

export type LeaderCollectionDiscoveries = Partial<Record<RegionalLeaderCollectionId, ItemId[]>>;

export function parseLeaderCollectionDiscoveries(value: string): LeaderCollectionDiscoveries {
  try {
    const root = JSON.parse(value) as Record<string, unknown>;
    const collections = root?.leaderCollections;
    if (!collections || typeof collections !== "object" || Array.isArray(collections)) return {};
    const rawDiscovered = (collections as Record<string, unknown>).discovered;
    if (!rawDiscovered || typeof rawDiscovered !== "object" || Array.isArray(rawDiscovered)) return {};
    const discovered: LeaderCollectionDiscoveries = {};
    for (const collectionId of Object.keys(REGIONAL_LEADER_COLLECTIONS) as RegionalLeaderCollectionId[]) {
      const valid = new Set<ItemId>(REGIONAL_LEADER_COLLECTIONS[collectionId].items.map(entry => entry.itemId));
      const raw = (rawDiscovered as Record<string, unknown>)[collectionId];
      if (!Array.isArray(raw)) continue;
      const items = [...new Set(raw.filter((item): item is ItemId => typeof item === "string" && valid.has(item as ItemId)))];
      if (items.length) discovered[collectionId] = items;
    }
    return discovered;
  } catch { return {}; }
}

export function leaderCollectionProgress(collectionId: RegionalLeaderCollectionId, discoveries: LeaderCollectionDiscoveries):
  { discovered: number; total: number; complete: boolean } {
  const total = REGIONAL_LEADER_COLLECTIONS[collectionId].items.length;
  const discovered = discoveries[collectionId]?.length ?? 0;
  return { discovered, total, complete: discovered === total };
}
