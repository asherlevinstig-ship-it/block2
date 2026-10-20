import type { MobArchetypeId } from "./mob-archetypes.js";

export type MistfenEventKind = "mireback-stampede" | "toxic-bloom" | "bog-hunt";

export type MistfenEventDefinition = {
  kind: MistfenEventKind;
  name: string;
  title: string;
  detail: string;
  progressLabel: string;
  followerCount: number;
  masteryReward: number;
  legendaryChance: number;
};

export const MISTFEN_EVENT_ID = "mistfen-mireheart";
export const MISTFEN_EVENT_TRACKING_RADIUS = 36;
export const MISTFEN_EVENT_FOLLOWER_PREFIX = "mistfen-event-follower-";

export const MISTFEN_DYNAMIC_EVENTS: readonly MistfenEventDefinition[] = [
  {
    kind: "mireback-stampede",
    name: "Stampeding Mireheart",
    title: "Mireback Stampede",
    detail: "Read the marked charge lanes, leave the boardwalk at the right moment, and punish each missed rush.",
    progressLabel: "REGIONAL EVENT · STAMPEDE",
    followerCount: 2,
    masteryReward: 15,
    legendaryChance: .04,
  },
  {
    kind: "toxic-bloom",
    name: "Toxic Mireheart",
    title: "Toxic Bloom",
    detail: "Destroy the spreading bloom guards before their venom zones consume the safe ground.",
    progressLabel: "REGIONAL EVENT · TOXIC BLOOM",
    followerCount: 3,
    masteryReward: 17,
    legendaryChance: .06,
  },
  {
    kind: "bog-hunt",
    name: "Bog-Hunt Mireheart",
    title: "Bog Hunt",
    detail: "Draw concealed ambushers out of the toxic pools, hold the crossing, then collapse on the Mireheart.",
    progressLabel: "REGIONAL EVENT · BOG HUNT",
    followerCount: 4,
    masteryReward: 19,
    legendaryChance: .08,
  },
] as const;

export function mistfenEventForSequence(sequence: number): MistfenEventDefinition {
  return MISTFEN_DYNAMIC_EVENTS[Math.max(0, Math.floor(sequence)) % MISTFEN_DYNAMIC_EVENTS.length]!;
}

export function mistfenEventDefinition(kind: string | null | undefined): MistfenEventDefinition | null {
  return MISTFEN_DYNAMIC_EVENTS.find(event => event.kind === kind) ?? null;
}

export function isMistfenEventFollower(id: string): boolean {
  return id.startsWith(MISTFEN_EVENT_FOLLOWER_PREFIX);
}

export function mistfenEventScale(kind: MistfenEventKind) {
  const players = 3;
  const level = 7;
  const event = mistfenEventDefinition(kind)!;
  return {
    players,
    level,
    followerCount: event.followerCount,
    healthMultiplier: 1,
    damageBonus: 0,
    speedMultiplier: kind === "mireback-stampede" ? 1.12 : 1,
    rewardMultiplier: 1,
  };
}

export function mistfenEventPattern(kind: MistfenEventKind, sequence: number, health: number, maxHealth: number): string {
  const enraged = maxHealth > 0 && health * 2 <= maxHealth;
  const rotation = kind === "mireback-stampede"
    ? enraged ? ["bog-charge", "bog-charge", "smash"] : ["bog-charge", "slam"]
    : kind === "toxic-bloom"
      ? enraged ? ["mirestorm", "toxic-eruption"] : ["toxic-eruption", "slam"]
      : enraged ? ["toxic-eruption", "smash", "bog-charge"] : ["slam", "bog-charge", "toxic-eruption"];
  return rotation[Math.max(0, sequence) % rotation.length]!;
}

export function mistfenEventFollowers(kind: MistfenEventKind, count: number, center: { x: number; y: number; z: number }) {
  const total = Math.max(1, Math.floor(count));
  return Array.from({ length: total }, (_, index) => {
    const angle = Math.PI / 4 + index * Math.PI * 2 / total;
    const radius = kind === "bog-hunt" ? 6.2 : kind === "mireback-stampede" ? 5.4 : 4.2;
    const archetype: MobArchetypeId = kind === "mireback-stampede" ? "stone_brute"
      : kind === "toxic-bloom" && index % 2 === 0 ? "cave_spitter" : "briar_crawler";
    return {
      id: `${MISTFEN_EVENT_FOLLOWER_PREFIX}${index}`,
      name: kind === "mireback-stampede" ? "Stampeding Mireback"
        : kind === "toxic-bloom" ? "Toxic Bloom Guard" : "Bog Ambusher",
      archetype,
      x: center.x + Math.cos(angle) * radius,
      y: center.y,
      z: center.z + Math.sin(angle) * radius,
    };
  });
}
