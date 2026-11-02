import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { TOWN_NPCS, canInteractWithTownNpc } from "@blockcraft/protocol";

export const BLACKSMITH_STALL = { ...TOWN_BLACKSMITH_STALL_POSITION, interactRange: 2.6 } as const;

export function canTradeAtBlacksmithStall(player: { x: number; y: number; z: number }, stallVisible: boolean, fastWorld = false): boolean {
  if (fastWorld) return canInteractWithTownNpc(player, TOWN_NPCS["smith-brom"]);
  return stallVisible
    && Math.abs(player.y - BLACKSMITH_STALL.y) <= 1.6
    && Math.hypot(player.x - BLACKSMITH_STALL.x, player.z - BLACKSMITH_STALL.z) <= BLACKSMITH_STALL.interactRange;
}
