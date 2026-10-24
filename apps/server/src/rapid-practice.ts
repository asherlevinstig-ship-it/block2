import type { MobArchetypeId } from "./mob-archetypes.js";
import type { FastWorldRegionId, MainHandId } from "@blockcraft/protocol";
import { FAST_WORLD_REGION_DEFINITIONS, fastWorldRegionDefinition, RAPID_PRACTICE_ARENA, RAPID_PRACTICE_TOWN_COLLIDERS } from "@blockcraft/protocol";
export { RAPID_PRACTICE_ARENA, RAPID_PRACTICE_TOWN_COLLIDERS } from "@blockcraft/protocol";

export type RapidPracticeSpawn = {
  id: string;
  archetype: MobArchetypeId;
  name: string;
  zone: RapidWorldZoneId;
  level: number;
  leader?: boolean;
  respawnMs: number;
  x: number;
  y: number;
  z: number;
};

export type RapidWorldZoneId = FastWorldRegionId;

export type RapidWorldZone = {
  id: RapidWorldZoneId;
  name: string;
  levelMin: number;
  levelMax: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  leaderId: string;
};

export const RAPID_WORLD_ZONES: readonly RapidWorldZone[] = FAST_WORLD_REGION_DEFINITIONS.map(region => ({
  id: region.id,
  name: region.name,
  levelMin: region.levelMin,
  levelMax: region.levelMax,
  minX: region.bounds.minX,
  maxX: region.bounds.maxX,
  minZ: region.bounds.minZ,
  maxZ: region.bounds.maxZ,
  leaderId: region.leaderId,
}));

export const rapidWorldZoneAt = (x: number, z: number): RapidWorldZone | null =>
  RAPID_WORLD_ZONES.find(zone => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) ?? null;

export const rapidPracticeGuardedReward = (encounterId: string): boolean =>
  FAST_WORLD_REGION_DEFINITIONS.some(region => region.encounterPockets?.some(pocket =>
    pocket.kind === "guarded-reward" && pocket.encounterIds.at(-1) === encounterId));

export const rapidMistfenToxicPoolAt = (x: number, z: number): boolean =>
  (fastWorldRegionDefinition("mistfen").hazards ?? []).some(pool => {
    const dx = (x - pool.x) / pool.radiusX;
    const dz = (z - pool.z) / pool.radiusZ;
    return dx * dx + dz * dz <= 1;
  });

const configuredRegionSpawns = (regionId: FastWorldRegionId): readonly RapidPracticeSpawn[] =>
  (fastWorldRegionDefinition(regionId).encounters ?? []).map(encounter => ({
    ...encounter,
    archetype: encounter.archetype as MobArchetypeId,
    zone: regionId,
  }));

export const RAPID_PRACTICE_SPAWNS: readonly RapidPracticeSpawn[] = [
  ...configuredRegionSpawns("greenwood"),

  ...configuredRegionSpawns("mistfen"),

  ...configuredRegionSpawns("sunken-coast"),

  { id: "quarry-stalker-a", archetype: "ridge_stalker", name: "Quarry Stalker", zone: "southern-quarry", level: 6, respawnMs: 58_000, x: 162.5, y: 8, z: 151.5 },
  { id: "quarry-stalker-b", archetype: "ridge_stalker", name: "Quarry Stalker", zone: "southern-quarry", level: 7, respawnMs: 61_000, x: 192.5, y: 8, z: 149.5 },
  { id: "quarry-sentry-a", archetype: "shard_sentry", name: "Iron Shard Sentry", zone: "southern-quarry", level: 7, respawnMs: 62_000, x: 168.5, y: 8, z: 177.5 },
  { id: "quarry-brute-a", archetype: "stone_brute", name: "Pit Brute", zone: "southern-quarry", level: 8, respawnMs: 66_000, x: 194.5, y: 8, z: 178.5 },
  { id: "quarry-sentry-b", archetype: "shard_sentry", name: "Iron Shard Sentry", zone: "southern-quarry", level: 9, respawnMs: 69_000, x: 181.5, y: 8, z: 167.5 },
  { id: "quarry-quarrymaster", archetype: "stone_brute", name: "Redstone Quarrymaster", zone: "southern-quarry", level: 9, leader: true, respawnMs: 86_000, x: 198.5, y: 8, z: 166.5 },

  { id: "ashen-hound-a", archetype: "ember_hound", name: "Ember Hound", zone: "ashen-reach", level: 9, respawnMs: 68_000, x: 214.5, y: 8, z: 87.5 },
  { id: "ashen-hound-b", archetype: "ember_hound", name: "Ember Hound", zone: "ashen-reach", level: 10, respawnMs: 71_000, x: 231.5, y: 8, z: 128.5 },
  { id: "ashen-sentry-a", archetype: "shard_sentry", name: "Ashglass Sentry", zone: "ashen-reach", level: 10, respawnMs: 72_000, x: 241.5, y: 8, z: 87.5 },
  { id: "ashen-ram-a", archetype: "cinder_ram", name: "Cinder Ram", zone: "ashen-reach", level: 11, respawnMs: 76_000, x: 216.5, y: 8, z: 120.5 },
  { id: "ashen-ram-b", archetype: "cinder_ram", name: "Cinder Ram", zone: "ashen-reach", level: 12, respawnMs: 80_000, x: 248.5, y: 8, z: 121.5 },
  { id: "ashen-cinderlord", archetype: "cinder_ram", name: "Cinderlord", zone: "ashen-reach", level: 12, leader: true, respawnMs: 100_000, x: 242.5, y: 8, z: 106.5 },
] as const;

export const RAPID_PRACTICE_WAVES = [
  RAPID_PRACTICE_SPAWNS.filter(spawn => spawn.zone === "greenwood").map(spawn => spawn.id),
  RAPID_PRACTICE_SPAWNS.filter(spawn => spawn.zone === "mistfen" || spawn.zone === "sunken-coast" || spawn.zone === "southern-quarry").map(spawn => spawn.id),
  RAPID_PRACTICE_SPAWNS.filter(spawn => spawn.zone === "ashen-reach").map(spawn => spawn.id),
] as const;

export const RAPID_PRACTICE_BOSS_ID = "ashen-cinderlord";
export const RAPID_PRACTICE_FREE_ROAM = true;
export const RAPID_PRACTICE_WAVE_DELAY_MS = 1_800;
export const RAPID_PRACTICE_RESTART_DELAY_MS = 4_000;
export const RAPID_PRACTICE_ATTACK_SCALE = .7;

export type RapidPracticeUpgradeId = "razor_edge" | "swift_hands" | "bloodstone";
export type RapidPracticeWeaponChoiceId = "weapon_sword" | "weapon_bow" | "weapon_focus";
export type RapidPracticeProjectileStyle = "crescent" | "arrow" | "orb";

export type RapidPracticeWeaponProfile = {
  style: RapidPracticeProjectileStyle;
  range: number;
  travelMs: number;
  pierce: number;
  splashRadius: number;
  bonusDamage: number;
};

export const RAPID_PRACTICE_WEAPON_CHOICES: Record<RapidPracticeWeaponChoiceId,
  { name: string; detail: string; mainHandId: MainHandId }> = {
  weapon_sword: { name: "Crescent Sword", detail: "Short-range arcs pierce up to 3 enemies", mainHandId: "forged_sword" },
  weapon_bow: { name: "Deadeye Bow", detail: "Fast precise shots deal +1 damage", mainHandId: "forged_bow" },
  weapon_focus: { name: "Nova Focus", detail: "Slower orbs splash nearby enemies", mainHandId: "forged_focus" },
};

export type RapidPracticeUpgrades = {
  damage: number;
  haste: number;
  vitality: number;
  relics: number;
};

export const EMPTY_RAPID_PRACTICE_UPGRADES: RapidPracticeUpgrades = {
  damage: 0,
  haste: 0,
  vitality: 0,
  relics: 0,
};

export const RAPID_PRACTICE_UPGRADE_LABELS: Record<RapidPracticeUpgradeId, { name: string; detail: string }> = {
  razor_edge: { name: "Razor Edge", detail: "+1 damage to every attack" },
  swift_hands: { name: "Swift Hands", detail: "10% faster attacks" },
  bloodstone: { name: "Bloodstone", detail: "+5 maximum health and heal" },
};

export function applyRapidPracticeUpgrade(
  current: RapidPracticeUpgrades,
  upgradeId: RapidPracticeUpgradeId,
  rare = false,
): RapidPracticeUpgrades {
  const amount = rare ? 2 : 1;
  return {
    damage: current.damage + (upgradeId === "razor_edge" ? amount : 0),
    haste: current.haste + (upgradeId === "swift_hands" ? amount : 0),
    vitality: current.vitality + (upgradeId === "bloodstone" ? amount : 0),
    relics: current.relics + Number(rare),
  };
}

export function rapidPracticeMovementSpeed(baseSpeed: number, enabled: boolean): number {
  return enabled ? baseSpeed * 1.38 : baseSpeed;
}

export function rapidPracticeProjectileTravelMs(travelMs: number, enabled: boolean): number {
  if (!enabled || travelMs <= 0) return travelMs;
  return Math.max(180, Math.round(travelMs * 0.68));
}

export function rapidPracticeWeaponProfile(mainHandId: MainHandId, enabled: boolean): RapidPracticeWeaponProfile | null {
  if (!enabled) return null;
  if (mainHandId === "longsword" || mainHandId === "forged_sword") return {
    style: "crescent", range: 4.6, travelMs: 160, pierce: 3, splashRadius: 0, bonusDamage: 0,
  };
  if (mainHandId === "bow" || mainHandId === "forged_bow") return {
    style: "arrow", range: 11, travelMs: 110, pierce: 1, splashRadius: 0, bonusDamage: 1,
  };
  if (mainHandId === "magic_focus" || mainHandId === "forged_focus") return {
    style: "orb", range: 8.5, travelMs: 250, pierce: 1, splashRadius: 1.8, bonusDamage: 0,
  };
  return null;
}

export function rapidPracticeAttackTiming<T extends { durationMs: number; impactMs: number }>(
  timing: T,
  enabled: boolean,
  haste = 0,
): T {
  if (!enabled) return timing;
  const scale = RAPID_PRACTICE_ATTACK_SCALE * Math.max(.55, Math.pow(.9, haste));
  return {
    ...timing,
    durationMs: Math.max(135, Math.round(timing.durationMs * scale)),
    impactMs: Math.max(55, Math.round(timing.impactMs * scale)),
  };
}

export function rapidPracticeProjectileFan<T extends { x: number; y: number; z: number }>(
  origin: { x: number; z: number },
  shots: readonly T[],
  enabled: boolean,
): T[] {
  if (!enabled) return [...shots];
  return shots.flatMap(shot => {
    const dx = shot.x - origin.x;
    const dz = shot.z - origin.z;
    const length = Math.max(.001, Math.hypot(dx, dz));
    const sideX = -dz / length * .72;
    const sideZ = dx / length * .72;
    return [
      { ...shot, x: shot.x + sideX, z: shot.z + sideZ },
      shot,
      { ...shot, x: shot.x - sideX, z: shot.z - sideZ },
    ];
  });
}
