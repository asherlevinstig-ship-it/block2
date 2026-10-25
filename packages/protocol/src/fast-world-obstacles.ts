export type FastWorldObstacleKind = "building" | "cliff" | "tree" | "encounter-cover";

export type FastWorldObstacle = {
  id: string;
  kind: FastWorldObstacleKind;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type FastWorldCollisionArena = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
};

export interface FastWorldObstacleQuery {
  readonly obstacles: readonly FastWorldObstacle[];
  groundHeight(x: number, z: number): number;
  obstacleAt(x: number, y: number, z: number): FastWorldObstacle | null;
  cellSolid(x: number, y: number, z: number): boolean;
}

type Footprint = { id: string; minX: number; maxX: number; minZ: number; maxZ: number };

const box = (id: string, kind: FastWorldObstacleKind, minX: number, maxX: number,
  minZ: number, maxZ: number, minY = 8, maxY = 11): FastWorldObstacle =>
  ({ id, kind, minX, maxX, minY, maxY, minZ, maxZ });

/**
 * Authored scenery which changes play. Decorative foliage deliberately stays
 * out of this list, so what looks like cover is cover without turning every
 * fern into a navigation obstacle.
 */
export const FAST_WORLD_SCENE_OBSTACLES: readonly FastWorldObstacle[] = [
  // Greenwood trunks visible in the low-poly scene.
  box("greenwood-tree-mosswatch-west", "tree", 117.6, 118.4, 88.6, 89.4, 8, 13),
  box("greenwood-tree-mosswatch-east", "tree", 129.6, 130.4, 86.6, 87.4, 8, 13),
  box("greenwood-tree-first-root-west", "tree", 120.6, 121.4, 118.6, 119.4, 8, 13),
  box("greenwood-tree-blighted-north", "tree", 144.6, 145.4, 114.6, 115.4, 8, 13),
  box("greenwood-tree-elderthorn-west", "tree", 144.6, 145.4, 97.6, 98.4, 8, 13),
  box("greenwood-tree-elderthorn-east", "tree", 154.6, 155.4, 99.6, 100.4, 8, 13),

  // Fallen logs create readable cover lanes in encounter spaces.
  // The gate-to-Mosswatch route stays intentionally open; cover starts once
  // players commit to one of the side encounters.
  box("greenwood-log-first-root", "encounter-cover", 126.1, 129.9, 116.45, 117.55, 8, 9.15),
  box("greenwood-log-fenward", "encounter-cover", 137.2, 140.8, 88.45, 89.55, 8, 9.15),
  box("greenwood-log-blighted", "encounter-cover", 140.4, 143.6, 121.45, 122.55, 8, 9.15),
  box("greenwood-log-elderthorn", "encounter-cover", 148.55, 151.45, 98.45, 99.55, 8, 9.15),
] as const;

export function createFastWorldObstacleQuery(
  arena: FastWorldCollisionArena,
  townFootprints: readonly Footprint[],
  groundHeight: (x: number, z: number) => number,
  sceneObstacles: readonly FastWorldObstacle[] = FAST_WORLD_SCENE_OBSTACLES,
): FastWorldObstacleQuery {
  const buildings = townFootprints.map(footprint => box(footprint.id, "building",
    footprint.minX, footprint.maxX, footprint.minZ, footprint.maxZ));
  const cliffs: FastWorldObstacle[] = [
    box("world-cliff-west", "cliff", arena.minX, arena.minX + .99, arena.minZ, arena.maxZ, 8, 12),
    box("world-cliff-east", "cliff", arena.maxX, arena.maxX + .99, arena.minZ, arena.maxZ, 8, 12),
    box("world-cliff-north", "cliff", arena.minX, arena.maxX, arena.minZ, arena.minZ + .99, 8, 12),
    box("world-cliff-south", "cliff", arena.minX, arena.maxX, arena.maxZ, arena.maxZ + .99, 8, 12),
  ];
  const obstacles = [...buildings, ...cliffs, ...sceneObstacles] as const;
  const obstacleAt = (x: number, y: number, z: number): FastWorldObstacle | null => obstacles.find(obstacle =>
    x >= obstacle.minX && x <= obstacle.maxX && y >= obstacle.minY && y <= obstacle.maxY
      && z >= obstacle.minZ && z <= obstacle.maxZ) ?? null;
  return {
    obstacles,
    groundHeight,
    obstacleAt,
    cellSolid(x, y, z) {
      const cellX = Math.floor(x), cellY = Math.floor(y), cellZ = Math.floor(z);
      const inside = cellX >= arena.minX && cellX <= arena.maxX
        && cellZ >= arena.minZ && cellZ <= arena.maxZ;
      if (!inside) return cellY >= arena.floorY && cellY <= 11;
      if (cellY === arena.floorY) return true;
      // The temporary block-reader adapter asks about whole cells. Test box
      // overlap rather than only the cell centre, otherwise a narrow trunk can
      // be visible and authoritative while still falling between samples.
      return obstacles.some(obstacle => cellX + 1 > obstacle.minX && cellX < obstacle.maxX
        && cellY + 1 > obstacle.minY && cellY < obstacle.maxY
        && cellZ + 1 > obstacle.minZ && cellZ < obstacle.maxZ);
    },
  };
}
