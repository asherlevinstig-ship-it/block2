import { TOWN_TAVERN_KEEPER_POSITION } from "@blockcraft/voxel-world";

export const TAVERN_KEEPER = {
  name: "Mara",
  ...TOWN_TAVERN_KEEPER_POSITION,
  talkRange: 2.6,
} as const;

export const TAVERN_KEEPER_LINES = [
  "Welcome to the Hearth & Hammer. I'm Mara. Come in and warm yourself by the fire.",
  "The east gate leads into rough country. Keep your weapon close and watch the road.",
  "Bring your stories back here. There will always be a place for you at this table.",
] as const;

export function canTalkToTavernKeeper(
  player: { x: number; y: number; z: number },
  keeperVisible: boolean,
): boolean {
  return keeperVisible
    && Math.abs(player.y - TAVERN_KEEPER.y) <= 1.6
    && Math.hypot(player.x - TAVERN_KEEPER.x, player.z - TAVERN_KEEPER.z) <= TAVERN_KEEPER.talkRange;
}
