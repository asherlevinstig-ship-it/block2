export const LEADER_REMATCH_CAP = 5;
export const LEADER_REMATCH_MODIFIERS = ["frenzied", "armoured", "venomous", "relentless"] as const;
export type LeaderRematchModifier = typeof LEADER_REMATCH_MODIFIERS[number];

export interface LeaderRematch {
  tier: number;
  modifier: LeaderRematchModifier | "";
  rewardLabel: string;
}

function stableOffset(id: string): number {
  let value = 0;
  for (let index = 0; index < id.length; index++) value = (value * 31 + id.charCodeAt(index)) >>> 0;
  return value % LEADER_REMATCH_MODIFIERS.length;
}

export function leaderRematch(id: string, defeats: number): LeaderRematch {
  const tier = Math.max(0, Math.min(LEADER_REMATCH_CAP, Math.floor(defeats)));
  if (tier === 0) return { tier: 0, modifier: "", rewardLabel: "GUARANTEED RELIC" };
  const modifier = LEADER_REMATCH_MODIFIERS[(stableOffset(id) + tier - 1) % LEADER_REMATCH_MODIFIERS.length]!;
  return { tier, modifier, rewardLabel: `GUARANTEED RELIC · +${Math.min(3, Math.ceil(tier / 2))} BONUS MATERIALS` };
}

export function leaderRematchStats(base: { maxHealth: number; damage: number; armor: number; speedMultiplier: number; rewardMultiplier: number }, rematch: LeaderRematch) {
  if (rematch.tier === 0) return base;
  const healthScale = 1 + rematch.tier * .1 + (rematch.modifier === "armoured" ? .15 : 0);
  const speedBonus = rematch.tier * .025 + (rematch.modifier === "frenzied" ? .12 : rematch.modifier === "relentless" ? .18 : 0);
  return {
    maxHealth: Math.min(120, Math.ceil(base.maxHealth * healthScale)),
    damage: Math.min(12, base.damage + Math.floor(rematch.tier / 2) + (rematch.modifier === "venomous" ? 1 : 0)),
    armor: Math.min(6, base.armor + (rematch.modifier === "armoured" ? 1 : 0)),
    speedMultiplier: Math.min(1.65, base.speedMultiplier * (1 + speedBonus)),
    rewardMultiplier: base.rewardMultiplier * (1 + rematch.tier * .2),
  };
}

export function leaderRematchTiming(modifier: string): { windup: number; cooldown: number } {
  if (modifier === "frenzied") return { windup: .82, cooldown: .76 };
  if (modifier === "relentless") return { windup: .9, cooldown: .84 };
  return { windup: 1, cooldown: 1 };
}

export function leaderRematchPressureCadence(tier: number, modifier: string): number {
  if (tier <= 0) return 3;
  if (modifier === "venomous" || modifier === "relentless" || tier >= 4) return 2;
  return 3;
}

export function leaderRematchPattern(base: string, archetype: string, sequence: number, modifier: string): string {
  if (modifier === "mirebreaker") return ["toxic-eruption", "mirestorm", "bog-charge"][sequence % 3]!;
  if (modifier === "rootslayer") return ["root-cage", "pincer-rush", "alpha-rush"][sequence % 3]!;
  if (!modifier) return base;
  if (modifier === "frenzied" && sequence % 2 === 1)
    return archetype === "cave_spitter" ? "fan" : archetype === "stone_brute" ? "smash" : "alpha-rush";
  if (modifier === "armoured" && sequence % 3 === 2)
    return archetype === "cave_spitter" ? "venom-ring" : archetype === "stone_brute" ? "warden-barrage" : "pack-rush";
  if (modifier === "venomous" && sequence % 3 === 1)
    return archetype === "cave_spitter" ? "pool" : archetype === "stone_brute" ? "rocks" : "pack-rush";
  if (modifier === "relentless" && sequence % 2 === 0)
    return archetype === "cave_spitter" ? "fan" : archetype === "stone_brute" ? "rocks" : "pack-rush";
  return base;
}

export function leaderRematchMaterialBonus(tier: number): number {
  return tier <= 0 ? 0 : Math.min(3, Math.ceil(tier / 2));
}

const LEADER_TERRITORIES: Readonly<Record<string, string>> = {
  "moss-crawler": "Greenwood Outskirts",
  "outskirts-crawler-west": "Westroad Outskirts",
  "outskirts-crawler-north": "Northroad Outskirts",
  "wild-crawler": "Greenwood Crawler Camp",
  "frontier-spitter": "Silver Guard Clearing",
  "wild-spitter-west-north": "Gloomfang Wilds",
  "stone-brute": "Stone Brute Clearing",
  "frontier-brute": "Frontier Ruins",
  "frontier-brute-east": "Eastern Frontier Warband",
  "ashglass-sentry-east": "Ashen Reach",
  "outskirts-west-pack:0": "Westroad Roaming Route",
  "outskirts-north-pack:0": "Northroad Roaming Route",
  "wilds-west-pack:0": "Gloam Roaming Route",
  "wilds-east-pack:0": "Sunscar Roaming Route",
  "shallow-cave-crawler": "Ironburrow Cavern",
  "deep-cave-spitter": "Silver Chamber",
  "buried-chamber-brute": "Buried Vault",
  "frontier-brute-west": "Western Rich Deposit",
  "mistfen-behemoth": "Mistfen Marsh",
};

export function leaderTerritory(id: string): string {
  return LEADER_TERRITORIES[id] ?? "Unknown Territory";
}
