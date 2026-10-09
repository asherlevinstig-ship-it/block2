import { Block, isProtectedVoxel } from "@blockcraft/voxel-world";
export { miningDurationMs } from "@blockcraft/voxel-world";
export const MINING_REACH = 4.5;
export const MINING_WINDUP_MS = 300;
export type MiningCell = { x: number; y: number; z: number; block: number };
export function miningReach(player: { x: number; y: number; z: number }, cell: MiningCell): number {
  return Math.hypot(cell.x + 0.5 - player.x, cell.y + 0.5 - player.y, cell.z + 0.5 - player.z);
}
export function miningAvailability(player: { x: number; y: number; z: number }, cell: MiningCell): "ready" | "far" | "protected" | "unbreakable" {
  if (miningReach(player, cell) > MINING_REACH) return "far";
  if (isProtectedVoxel(cell.x, cell.z)) return "protected";
  if (cell.block === Block.Air || cell.block === Block.Bedrock) return "unbreakable";
  return "ready";
}
export function miningProgress(start: number, now: number, durationMs = MINING_WINDUP_MS): number {
  return Math.max(0, Math.min(1, (now - start) / Math.max(1, durationMs)));
}
