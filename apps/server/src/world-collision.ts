import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { FAST_WORLD_COLLISION_QUERY, type FastWorldObstacleQuery } from "@blockcraft/protocol";

/** Converts the non-voxel Fast World query into the reader currently consumed
 * by movement/combat helpers. The adapter is the only voxel-shaped boundary. */
export function obstacleQueryReader(query: FastWorldObstacleQuery): WorldBlockReader {
  return Object.assign(
    (x: number, y: number, z: number) => query.cellSolid(x, y, z) ? Block.Stone : Block.Air,
    { groundHeight: (x: number, z: number) => query.groundHeight(x, z) },
  );
}

export const FAST_WORLD_BLOCK_READER = obstacleQueryReader(FAST_WORLD_COLLISION_QUERY);

/** Legacy worlds keep their native chunk reader unchanged behind this adapter. */
export function legacyCollisionReader(read: WorldBlockReader): WorldBlockReader {
  return Object.assign((x: number, y: number, z: number) => read(x, y, z),
    read.groundHeight ? { groundHeight: read.groundHeight } : {});
}
