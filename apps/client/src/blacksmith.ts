import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { FAST_WORLD_BLACKSMITH_POSITION } from "@blockcraft/protocol";

export const BLACKSMITH_STALL = { ...TOWN_BLACKSMITH_STALL_POSITION, interactRange: 2.6 } as const;

export function canTradeAtBlacksmithStall(player: { x: number; y: number; z: number }, stallVisible: boolean, fastWorld = false): boolean {
  const stall = fastWorld ? FAST_WORLD_BLACKSMITH_POSITION : BLACKSMITH_STALL;
  return (fastWorld || stallVisible)
    && Math.abs(player.y - stall.y) <= 1.6
    && Math.hypot(player.x - stall.x, player.z - stall.z) <= BLACKSMITH_STALL.interactRange;
}
