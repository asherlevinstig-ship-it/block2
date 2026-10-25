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

  // Sunken Coast wrecks and larger rocks are real cover: they interrupt
  // sight, projectiles and pursuit instead of being purely decorative.
  box("coast-wreck-brine-landing", "encounter-cover", 49, 53.4, 156.8, 159.2, 8, 9.45),
  box("coast-wreck-drowned", "encounter-cover", 58.6, 63.5, 180.4, 183.6, 8, 9.45),
  box("coast-wreck-east-route", "encounter-cover", 86, 90.2, 151.8, 154.2, 8, 9.35),
  box("coast-wreck-far-shore", "encounter-cover", 95.4, 100.5, 176.6, 179.5, 8, 9.45),
  box("coast-rock-west", "encounter-cover", 44.35, 45.65, 180.35, 181.65, 8, 9.35),
  box("coast-rock-shoal", "encounter-cover", 66.25, 67.75, 161.25, 162.75, 8, 9.45),
  box("coast-rock-saltwatch", "encounter-cover", 88.3, 89.7, 166.3, 167.7, 8, 9.4),

  // Quarry boulders and timber supports form the cover rhythm visible on the
  // shelves. Their conservative boxes leave every authored ramp traversable.
  box("quarry-boulder-scree", "encounter-cover", 160.35, 161.65, 152.35, 153.65, 8, 9.3),
  box("quarry-boulder-foreman", "encounter-cover", 192.25, 193.75, 158.25, 159.75, 8, 9.5),
  box("quarry-boulder-lift", "encounter-cover", 187.3, 188.7, 173.3, 174.7, 8, 9.4),
  box("quarry-support-scree", "encounter-cover", 162.1, 165.9, 155.55, 156.45, 8, 10.2),
  box("quarry-support-lift", "encounter-cover", 171.9, 176.1, 172.5, 173.5, 8, 10.2),
  box("quarry-support-foreman", "encounter-cover", 188.1, 191.9, 153.45, 154.55, 8, 10.2),
  box("quarry-support-pit", "encounter-cover", 191.8, 196.2, 167.45, 168.55, 8, 10.2),

  // Basalt spires are both the Reach's skyline and its hard cover.
  box("ashen-spire-ember-gate", "encounter-cover", 210.4, 211.6, 90.4, 91.6, 8, 10.4),
  box("ashen-spire-west", "encounter-cover", 219.4, 220.6, 77.4, 78.6, 8, 11.2),
  box("ashen-spire-south", "encounter-cover", 236.4, 237.6, 133.4, 134.6, 8, 10.8),
  box("ashen-spire-east", "encounter-cover", 250.4, 251.6, 83.4, 84.6, 8, 11.5),
  box("ashen-spire-glass-ridge", "encounter-cover", 252.4, 253.6, 121.4, 122.6, 8, 10.6),
  box("ashen-spire-cinder-lane", "encounter-cover", 224.4, 225.6, 128.4, 129.6, 8, 10.2),
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
