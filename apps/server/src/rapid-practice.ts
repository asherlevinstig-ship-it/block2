import type { MobArchetypeId } from "./mob-archetypes.js";
import type { MainHandId } from "@blockcraft/protocol";

export const RAPID_PRACTICE_ARENA = {
  minX: 88,
  maxX: 128,
  minZ: 90,
  maxZ: 122,
  floorY: 7,
  spawn: { x: 99.5, y: 8, z: 106.5 },
} as const;

export type RapidPracticeSpawn = {
  id: string;
  archetype: MobArchetypeId;
  x: number;
  y: number;
  z: number;
};

export const RAPID_PRACTICE_SPAWNS: readonly RapidPracticeSpawn[] = [
  { id: "rapid-crawler-01", archetype: "moss_crawler", x: 106.5, y: 8, z: 99.5 },
  { id: "rapid-crawler-02", archetype: "moss_crawler", x: 109.5, y: 8, z: 102.5 },
  { id: "rapid-crawler-03", archetype: "briar_crawler", x: 113.5, y: 8, z: 97.5 },
  { id: "rapid-crawler-04", archetype: "briar_crawler", x: 119.5, y: 8, z: 103.5 },
  { id: "rapid-crawler-05", archetype: "moss_crawler", x: 123.5, y: 8, z: 108.5 },
  { id: "rapid-crawler-06", archetype: "briar_crawler", x: 118.5, y: 8, z: 115.5 },
  { id: "rapid-crawler-07", archetype: "moss_crawler", x: 109.5, y: 8, z: 118.5 },
  { id: "rapid-crawler-08", archetype: "briar_crawler", x: 101.5, y: 8, z: 116.5 },
  { id: "rapid-spitter-01", archetype: "cave_spitter", x: 111.5, y: 8, z: 93.5 },
  { id: "rapid-spitter-02", archetype: "cave_spitter", x: 125.5, y: 8, z: 100.5 },
  { id: "rapid-spitter-03", archetype: "cave_spitter", x: 125.5, y: 8, z: 117.5 },
  { id: "rapid-spitter-04", archetype: "cave_spitter", x: 113.5, y: 8, z: 120.5 },
  { id: "rapid-stalker-01", archetype: "ridge_stalker", x: 116.5, y: 8, z: 106.5 },
  { id: "rapid-stalker-02", archetype: "ridge_stalker", x: 121.5, y: 8, z: 112.5 },
  { id: "rapid-stalker-03", archetype: "ridge_stalker", x: 106.5, y: 8, z: 111.5 },
  { id: "rapid-brute-01", archetype: "stone_brute", x: 121.5, y: 8, z: 94.5 },
  { id: "rapid-brute-02", archetype: "stone_brute", x: 126.5, y: 8, z: 111.5 },
  { id: "rapid-brute-03", archetype: "stone_brute", x: 115.5, y: 8, z: 110.5 },
] as const;

export const RAPID_PRACTICE_WAVES = [
  ["rapid-crawler-01", "rapid-crawler-02", "rapid-crawler-03", "rapid-crawler-04", "rapid-spitter-01", "rapid-stalker-01"],
  ["rapid-crawler-05", "rapid-crawler-06", "rapid-crawler-07", "rapid-crawler-08", "rapid-spitter-02", "rapid-spitter-03", "rapid-stalker-02"],
  ["rapid-spitter-04", "rapid-stalker-03", "rapid-brute-01", "rapid-brute-02", "rapid-brute-03"],
] as const;

export const RAPID_PRACTICE_BOSS_ID = "rapid-brute-03";
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
