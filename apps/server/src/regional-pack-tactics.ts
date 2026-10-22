import type { MobArchetypeId } from "./mob-archetypes.js";

type Point = { x: number; y: number; z: number };

export const REGIONAL_PACK_DISRUPTION_MS = 3_500;

export type RegionalPackCue = "PINNING" | "FLANKING" | "VENOM LOCK" | "BLOCKING ESCAPE"
  | "BREACHING" | "COVERING FIRE" | "PINCER RUSH" | "CENTRE PRESSURE" | "HOLDING PASS";

function region(packId: string): "greenwood" | "mistfen" | "northwatch" | "stoneheart" | "ashen" | null {
  if (packId.startsWith("greenwood-")) return "greenwood";
  if (packId.startsWith("mistfen-")) return "mistfen";
  if (packId.startsWith("northwatch-")) return "northwatch";
  if (packId.startsWith("stoneheart-")) return "stoneheart";
  if (packId.startsWith("ashen-")) return "ashen";
  return null;
}

/** Short-lived in-world wording shown when a fixed regional formation engages. */
export function regionalPackCue(packId: string, archetype: MobArchetypeId, memberIndex: number): RegionalPackCue | null {
  const identity = region(packId);
  if (identity === "greenwood") return memberIndex === 0 ? "PINNING" : "FLANKING";
  if (identity === "mistfen") return archetype === "fen_bloater" ? "BLOCKING ESCAPE" : "VENOM LOCK";
  if (identity === "northwatch") return archetype === "shard_sentry" ? "COVERING FIRE"
    : memberIndex === 0 ? "HOLDING PASS" : "FLANKING";
  if (identity === "stoneheart") return archetype === "stone_brute" ? "BREACHING" : "COVERING FIRE";
  if (identity === "ashen") return archetype === "ember_hound" ? "PINCER RUSH"
    : archetype === "cinder_ram" ? "CENTRE PRESSURE" : "COVERING FIRE";
  return null;
}

/** Fixed formation geometry: party size and player level never alter it. */
export function regionalPackGoal(packId: string, archetype: MobArchetypeId, memberIndex: number,
  target: Point, leader: Point): Point | null {
  const identity = region(packId);
  if (!identity) return null;
  const distance = Math.hypot(target.x - leader.x, target.z - leader.z) || 1;
  const forwardX = (target.x - leader.x) / distance, forwardZ = (target.z - leader.z) / distance;
  const sideX = -forwardZ, sideZ = forwardX;
  const side = memberIndex % 2 === 0 ? 1 : -1;
  const point = (forward: number, lateral: number): Point => ({
    x: target.x + forwardX * forward + sideX * lateral,
    y: target.y,
    z: target.z + forwardZ * forward + sideZ * lateral,
  });
  if (identity === "greenwood") return memberIndex === 0 ? point(-1.8, 0) : point(-.25, side * 2.25);
  if (identity === "mistfen") return archetype === "fen_bloater" ? point(1.9, 0)
    : archetype === "cave_spitter" ? point(-4.6, side * 2.2) : point(-.4, side * 2.1);
  if (identity === "northwatch") return archetype === "shard_sentry" ? point(-5.2, side * 1.8)
    : memberIndex === 0 ? point(-1.8, 0) : point(-.2, side * 2.4);
  if (identity === "stoneheart") return archetype === "stone_brute" ? point(-2.1, 0)
    : point(-4.8, side * 2.4);
  return archetype === "cinder_ram" ? point(-2.1, 0)
    : archetype === "ember_hound" ? point(-.3, side * 2.5) : point(-5, side * 1.9);
}

export function regionalPackSpeedMultiplier(packId: string, archetype: MobArchetypeId, disrupted: boolean): number {
  if (disrupted) return .65;
  const identity = region(packId);
  if (identity === "greenwood" && archetype !== "cave_spitter") return 1.08;
  if (identity === "mistfen" && archetype === "fen_bloater") return 1.06;
  if (identity === "northwatch" && archetype === "ridge_stalker") return 1.1;
  if (identity === "stoneheart" && archetype === "stone_brute") return 1.08;
  if (identity === "ashen" && archetype === "ember_hound") return 1.12;
  return 1;
}

export function regionalPackCooldownMultiplier(disrupted: boolean): number {
  return disrupted ? 1.45 : 1;
}
