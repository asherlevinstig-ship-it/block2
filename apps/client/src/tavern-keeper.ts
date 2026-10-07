import { TOWN_TAVERN_KEEPER_POSITION, TOWN_TAVERN_QUIZ_TABLE_POSITION } from "@blockcraft/voxel-world";

export const TAVERN_KEEPER = {
  name: "Mara",
  ...TOWN_TAVERN_KEEPER_POSITION,
  talkRange: 2.6,
} as const;

export const TAVERN_KEEPER_LINES = [
  "Welcome to the Hearth & Hammer. I'm Mara. Come in and warm yourself by the fire.",
  "The east gate leads into rough country. Keep your weapon close and watch the road.",
  "Fancy a round of Double or Quit? Head to the blue-and-gold table and press E.",
] as const;

export const TAVERN_QUIZ_TABLE = { ...TOWN_TAVERN_QUIZ_TABLE_POSITION, interactRange: 2.6 } as const;

export function canPlayAtTavernTable(player: { x: number; y: number; z: number }, tavernVisible: boolean): boolean {
  return tavernVisible
    && Math.abs(player.y - TAVERN_QUIZ_TABLE.y) <= 1.6
    && Math.hypot(player.x - TAVERN_QUIZ_TABLE.x, player.z - TAVERN_QUIZ_TABLE.z) <= TAVERN_QUIZ_TABLE.interactRange;
}

export function canTalkToTavernKeeper(
  player: { x: number; y: number; z: number },
  keeperVisible: boolean,
): boolean {
  return keeperVisible
    && Math.abs(player.y - TAVERN_KEEPER.y) <= 1.6
    && Math.hypot(player.x - TAVERN_KEEPER.x, player.z - TAVERN_KEEPER.z) <= TAVERN_KEEPER.talkRange;
}
