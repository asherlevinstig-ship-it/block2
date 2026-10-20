import type { MobArchetypeId } from "./mob-archetypes.js";

export type GreenwoodEventKind = "crawler-migration" | "root-nest" | "alpha-ambush";

export type GreenwoodEventDefinition = {
  kind: GreenwoodEventKind;
  name: string;
  title: string;
  detail: string;
  progressLabel: string;
  followerCount: number;
  masteryReward: number;
  legendaryChance: number;
};

export const GREENWOOD_EVENT_TRACKING_RADIUS = 34;
export const GREENWOOD_EVENT_FOLLOWER_PREFIX = "greenwood-event-follower-";

export const GREENWOOD_DYNAMIC_EVENTS: readonly GreenwoodEventDefinition[] = [
  {
    kind: "crawler-migration",
    name: "Migrating Venom Matriarch",
    title: "Crawler Migration",
    detail: "Intercept the moving Matriarch and its elite escort before the pack crosses Greenwood.",
    progressLabel: "REGIONAL EVENT · MIGRATION",
    followerCount: 2,
    masteryReward: 14,
    legendaryChance: .04,
  },
  {
    kind: "root-nest",
    name: "Root-Nest Matriarch",
    title: "Root Nest",
    detail: "Break the rootbound guards, escape the closing root lanes, then pressure the Matriarch.",
    progressLabel: "REGIONAL EVENT · ROOT NEST",
    followerCount: 3,
    masteryReward: 16,
    legendaryChance: .06,
  },
  {
    kind: "alpha-ambush",
    name: "Greenwood Pack Alpha",
    title: "Alpha Ambush",
    detail: "Survive the encircling elite pack and collapse on its alpha during recovery.",
    progressLabel: "REGIONAL EVENT · AMBUSH",
    followerCount: 4,
    masteryReward: 18,
    legendaryChance: .08,
  },
] as const;

export function greenwoodEventForSequence(sequence: number): GreenwoodEventDefinition {
  return GREENWOOD_DYNAMIC_EVENTS[Math.max(0, Math.floor(sequence)) % GREENWOOD_DYNAMIC_EVENTS.length]!;
}

export function greenwoodEventDefinition(kind: string | null | undefined): GreenwoodEventDefinition | null {
  return GREENWOOD_DYNAMIC_EVENTS.find(event => event.kind === kind) ?? null;
}

export function isGreenwoodEventFollower(id: string): boolean {
  return id.startsWith(GREENWOOD_EVENT_FOLLOWER_PREFIX);
}

export function greenwoodEventScale(kind: GreenwoodEventKind) {
  const players = 2;
  const level = 4;
  const event = greenwoodEventDefinition(kind)!;
  return {
    players,
    level,
    followerCount: event.followerCount,
    healthMultiplier: 1,
    damageBonus: 0,
    speedMultiplier: kind === "crawler-migration" ? 1.18 : kind === "alpha-ambush" ? 1.1 : 1,
    rewardMultiplier: 1,
  };
}

export function greenwoodEventFollowers(kind: GreenwoodEventKind, count: number, center: { x: number; y: number; z: number }) {
  const total = Math.max(1, Math.floor(count));
  return Array.from({ length: total }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / total;
    const radius = kind === "alpha-ambush" ? 5.4 : kind === "crawler-migration" ? 4.6 : 3.8;
    const archetype: MobArchetypeId = kind === "root-nest" || index % 2 === 1 ? "briar_crawler" : "moss_crawler";
    return {
      id: `${GREENWOOD_EVENT_FOLLOWER_PREFIX}${index}`,
      name: kind === "root-nest" ? "Rootbound Guard" : kind === "alpha-ambush" ? "Ambush Stalker" : "Migrating Crawler",
      archetype,
      x: center.x + Math.cos(angle) * radius,
      y: center.y,
      z: center.z + Math.sin(angle) * radius,
    };
  });
}
