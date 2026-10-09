import { PLAYER_HEIGHT, PLAYER_RADIUS } from "@blockcraft/voxel-world";
export function mineralCellOccupied(cell: { x: number; y: number; z: number }, occupants: Iterable<{ x: number; y: number; z: number }>): boolean {
  for (const player of occupants) {
    if (player.y >= cell.y + 1 || player.y + PLAYER_HEIGHT <= cell.y) continue;
    const nearX = Math.max(cell.x, Math.min(player.x, cell.x + 1));
    const nearZ = Math.max(cell.z, Math.min(player.z, cell.z + 1));
    if (Math.hypot(player.x - nearX, player.z - nearZ) < PLAYER_RADIUS + 0.02) return true;
  }
  return false;
}
