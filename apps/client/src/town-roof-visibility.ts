export interface TownRoofFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Hold a roof open briefly beyond its footprint so doorway corrections cannot toggle it every frame. */
export function roofCutawayLodge<T extends TownRoofFootprint>(
  player: { x: number; y: number; z: number },
  current: T | null,
  lodges: readonly T[],
  surfaceY: number,
): T | null {
  if (player.y < surfaceY - 0.5 || player.y > surfaceY + 1.25) return null;
  const within = (lodge: T, margin: number) => player.x >= lodge.minX - margin
    && player.x <= lodge.maxX + 1 + margin
    && player.z >= lodge.minZ - margin
    && player.z <= lodge.maxZ + 1 + margin;
  if (current && within(current, 0.65)) return current;
  return lodges.find(lodge => within(lodge, 0)) ?? null;
}

export function hidesTownRoof(lodge: TownRoofFootprint | null, x: number, y: number, z: number): boolean {
  return lodge !== null && y === 10
    && x >= lodge.minX && x <= lodge.maxX
    && z >= lodge.minZ && z <= lodge.maxZ;
}
