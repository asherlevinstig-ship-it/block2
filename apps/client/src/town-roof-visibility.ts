export interface TownRoofFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  roofBaseY: number;
  roofTopY: number;
}

/** Hold a roof open briefly beyond its footprint so doorway corrections cannot toggle it every frame. */
export function roofCutawayBuilding<T extends TownRoofFootprint>(
  player: { x: number; y: number; z: number },
  current: T | null,
  buildings: readonly T[],
  surfaceY: number,
): T | null {
  if (player.y < surfaceY - 0.5 || player.y > surfaceY + 1.25) return null;
  const within = (building: T, margin: number) => player.x >= building.minX - margin
    && player.x <= building.maxX + 1 + margin
    && player.z >= building.minZ - margin
    && player.z <= building.maxZ + 1 + margin;
  if (current && within(current, 0.65)) return current;
  return buildings.find(building => within(building, 0)) ?? null;
}

export function hidesTownRoof(building: TownRoofFootprint | null, x: number, y: number, z: number): boolean {
  return building !== null && y >= building.roofBaseY && y <= building.roofTopY
    && x >= building.minX && x <= building.maxX
    && z >= building.minZ && z <= building.maxZ;
}
