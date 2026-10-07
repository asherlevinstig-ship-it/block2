import { IRON_ORE_GOLD_PRICE } from "@blockcraft/protocol";
import { Block, TOWN_BLACKSMITH_STALL_POSITION, type BlockId } from "@blockcraft/voxel-world";

export const MAX_GOLD = 1_000_000;

export function minedMineral(block: BlockId): "iron_ore" | null {
  return block === Block.IronOre ? "iron_ore" : null;
}

export function canTradeAtBlacksmith(player: { x: number; y: number; z: number }): boolean {
  return Math.abs(player.y - TOWN_BLACKSMITH_STALL_POSITION.y) <= 1.6
    && Math.hypot(player.x - TOWN_BLACKSMITH_STALL_POSITION.x, player.z - TOWN_BLACKSMITH_STALL_POSITION.z) <= 2.6;
}

export function ironOreSale(available: number, gold: number): { sold: number; goldGranted: number } {
  const sold = Math.max(0, Math.min(Math.floor(available), Math.floor((MAX_GOLD - gold) / IRON_ORE_GOLD_PRICE)));
  return { sold, goldGranted: sold * IRON_ORE_GOLD_PRICE };
}
