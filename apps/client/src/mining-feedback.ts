import { Block, isProtectedVoxel } from "@blockcraft/voxel-world";
export { miningDurationMs } from "@blockcraft/voxel-world";
export { miningLineClear } from "@blockcraft/voxel-world";
export const MINING_REACH = 4.5;
export const MINING_WINDUP_MS = 300;
export type MiningCell = { x: number; y: number; z: number; block: number };
export function miningMessage(reason: string): string {
  if (reason === "moving") return "Mining cancelled · stand still to mine.";
  if (reason === "far" || reason === "range") return "Out of reach · move closer, then mine.";
  if (reason === "collision") return "Blocked · a wall is between you and that block.";
  if (reason === "protected") return "Protected · this block cannot be mined.";
  if (reason === "unbreakable") return "Unbreakable · choose a different block.";
  if (reason === "missing" || reason === "stale") return "Mining cancelled · the block changed. Aim again.";
  if (reason === "timeout") return "Mining cancelled · server confirmation timed out. Try again.";
  if (reason === "mode") return "Mining cancelled · switched to combat.";
  if (reason === "rate") return "Mining unavailable · finish your current action first.";
  return "Mining cancelled.";
}
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
