import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";

export const BLACKSMITH_STALL = { ...TOWN_BLACKSMITH_STALL_POSITION, interactRange: 2.6 } as const;

export function canTradeAtBlacksmithStall(player: { x: number; y: number; z: number }, stallVisible: boolean): boolean {
  return stallVisible
    && Math.abs(player.y - BLACKSMITH_STALL.y) <= 1.6
    && Math.hypot(player.x - BLACKSMITH_STALL.x, player.z - BLACKSMITH_STALL.z) <= BLACKSMITH_STALL.interactRange;
}
