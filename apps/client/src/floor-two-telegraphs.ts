export type FloorTwoTelegraphStyle = {
  range: number;
  color: readonly [number, number, number];
  lockedColor: readonly [number, number, number];
  pulseHz: number;
  bodyGlow: number;
};

/**
 * Floor 2 teaches attack reading, so every enemy family gets a consistent
 * high-contrast tell. This is presentation-only: the footprint and timing
 * still come from the authoritative attack state.
 */
export function floorTwoTelegraphStyle(mobId: string, archetype: string,
  attackPattern = ""): FloorTwoTelegraphStyle | null {
  if (!mobId.startsWith("floor2-")) return null;
  if (mobId === "floor2-forgeheart") {
    if (["rocks", "warden-barrage", "fault-line"].includes(attackPattern)) return {
      range: 42, color: [1, .2, .62], lockedColor: [1, .52, .86], pulseHz: 4.8, bodyGlow: .72,
    };
    if (attackPattern === "charge") return {
      range: 42, color: [1, .09, .015], lockedColor: [1, .5, .04], pulseHz: 5.4, bodyGlow: .82,
    };
    return { range: 42, color: [1, .24, .025], lockedColor: [1, .72, .08], pulseHz: 4.2, bodyGlow: .76 };
  }
  if (archetype === "cinder_ram") return {
    range: 30, color: [1, .1, .015], lockedColor: [1, .58, .035], pulseHz: 5.2, bodyGlow: .68,
  };
  if (archetype === "ember_hound") return {
    range: 26, color: [1, .32, .025], lockedColor: [1, .82, .1], pulseHz: 6.2, bodyGlow: .6,
  };
  if (archetype === "fen_bloater") return {
    range: 30, color: [.18, 1, .42], lockedColor: [.68, 1, .18], pulseHz: 3.6, bodyGlow: .58,
  };
  if (archetype === "shard_sentry" || archetype === "cave_spitter") return {
    range: 36, color: [.12, .72, 1], lockedColor: [.58, .94, 1], pulseHz: 4.6, bodyGlow: .55,
  };
  return { range: 32, color: [1, .28, .06], lockedColor: [1, .72, .12], pulseHz: 4, bodyGlow: .62 };
}
