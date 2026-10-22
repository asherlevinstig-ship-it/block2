import { REGIONAL_LEADER_COLLECTIONS, type ItemId, type RegionalLeaderCollectionId } from "@blockcraft/protocol";
import { ASHEN_SENTRY_HOMES, FRONTIER_WARLEADER_HOME, GREENWOOD_ENCOUNTER_CHAIN, MISTFEN_ENCOUNTER_CHAIN,
  NORTHWATCH_ENCOUNTER_CHAIN, SOUTHERN_QUARRY_ENCOUNTER_CHAIN } from "@blockcraft/voxel-world";

export type LeaderCollectionDiscoveries = Partial<Record<RegionalLeaderCollectionId, ItemId[]>>;
export type TrackedLeaderCollectionHunt = { collectionId: RegionalLeaderCollectionId; itemId: ItemId };

const LEADER_COLLECTION_POINTS = {
  greenwood: { ...GREENWOOD_ENCOUNTER_CHAIN.leader, y: 8 },
  mistfen: { ...MISTFEN_ENCOUNTER_CHAIN.leader, y: 8 },
  quarry: SOUTHERN_QUARRY_ENCOUNTER_CHAIN.leader,
  northwatch: { ...NORTHWATCH_ENCOUNTER_CHAIN.leader, y: 8 },
  frontier: FRONTIER_WARLEADER_HOME,
  ashen: ASHEN_SENTRY_HOMES[1],
} as const satisfies Record<RegionalLeaderCollectionId, { x: number; y: number; z: number }>;
const LEADER_COLLECTION_MOBS = {
  greenwood: "wild-crawler",
  mistfen: "mistfen-behemoth",
  quarry: "south-quarrymaster",
  northwatch: "northwatch-watchbreaker",
  frontier: "frontier-brute-east",
  ashen: "ashglass-sentry-east",
} as const satisfies Record<RegionalLeaderCollectionId, string>;

export type TrackedLeaderArenaPresentation = {
  phase: "ready" | "battle" | "respawning";
  difficulty: string;
  party: string;
  slot: string;
  respawnSeconds: number;
};

export function leaderCollectionMobId(collectionId: RegionalLeaderCollectionId): string {
  return LEADER_COLLECTION_MOBS[collectionId];
}

export function trackedLeaderArenaPresentation(tracked: TrackedLeaderCollectionHunt,
  mob: { id: string; alive: boolean; combatState: string; targetId: string; respawnAt: number },
  player: { x: number; y: number; z: number; alive: boolean }, serverNow: number, radius = 26): TrackedLeaderArenaPresentation | null {
  if (mob.id !== leaderCollectionMobId(tracked.collectionId)
    || Math.abs(player.y - LEADER_COLLECTION_POINTS[tracked.collectionId].y) > 2.5
    || Math.hypot(player.x - LEADER_COLLECTION_POINTS[tracked.collectionId].x,
      player.z - LEADER_COLLECTION_POINTS[tracked.collectionId].z) > radius) return null;
  const tier = leaderCollectionRematchTier(tracked.collectionId, tracked.itemId);
  const difficulty = tier ? `EMPOWERED ${["", "I", "II", "III"][tier] ?? tier}` : "NORMAL";
  const party = tier >= 3 ? "3 PLAYERS RECOMMENDED" : tier >= 2 ? "2–3 PLAYERS RECOMMENDED" : "2 PLAYERS RECOMMENDED";
  const slotIndex = REGIONAL_LEADER_COLLECTIONS[tracked.collectionId].items.findIndex(entry => entry.itemId === tracked.itemId) + 1;
  const battle = player.alive && mob.alive && Boolean(mob.targetId);
  const respawnSeconds = !mob.alive && mob.respawnAt > serverNow ? Math.max(1, Math.ceil((mob.respawnAt - serverNow) / 1_000)) : 0;
  return { phase: battle ? "battle" : respawnSeconds > 0 ? "respawning" : "ready", difficulty, party,
    slot: `COLLECTION SLOT ${slotIndex} · UNKNOWN`, respawnSeconds };
}

export function leaderCollectionRematchTier(collectionId: RegionalLeaderCollectionId, itemId: ItemId): number {
  const entry = REGIONAL_LEADER_COLLECTIONS[collectionId].items.find(candidate => candidate.itemId === itemId);
  return entry && "minRematchTier" in entry ? entry.minRematchTier : 0;
}

export function leaderCollectionTarget(collectionId: RegionalLeaderCollectionId, itemId: ItemId) {
  const definition = REGIONAL_LEADER_COLLECTIONS[collectionId];
  const tier = leaderCollectionRematchTier(collectionId, itemId);
  return { ...LEADER_COLLECTION_POINTS[collectionId], id: `leader-collection-${collectionId}`,
    name: `${definition.leaderName} · ${tier ? `Empowered Rematch ${["", "I", "II", "III"][tier] ?? tier}` : "Leader Hunt"}` };
}

export function parseTrackedLeaderCollectionHunt(value: string | null): TrackedLeaderCollectionHunt | null {
  try {
    const parsed = JSON.parse(value ?? "null") as Partial<TrackedLeaderCollectionHunt> | null;
    if (!parsed || typeof parsed.collectionId !== "string" || !Object.hasOwn(REGIONAL_LEADER_COLLECTIONS, parsed.collectionId)
      || typeof parsed.itemId !== "string") return null;
    const collectionId = parsed.collectionId as RegionalLeaderCollectionId;
    return REGIONAL_LEADER_COLLECTIONS[collectionId].items.some(entry => entry.itemId === parsed.itemId)
      ? { collectionId, itemId: parsed.itemId as ItemId } : null;
  } catch { return null; }
}

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

export function advanceTrackedLeaderCollectionHunt(tracked: TrackedLeaderCollectionHunt,
  discoveries: LeaderCollectionDiscoveries): TrackedLeaderCollectionHunt | null {
  const found = discoveries[tracked.collectionId] ?? [];
  if (!found.includes(tracked.itemId)) return tracked;
  const next = REGIONAL_LEADER_COLLECTIONS[tracked.collectionId].items.find(entry => !found.includes(entry.itemId));
  return next ? { collectionId: tracked.collectionId, itemId: next.itemId } : null;
}
