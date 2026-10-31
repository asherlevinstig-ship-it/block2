import { TOWN_TAVERN_KEEPER_POSITION, TOWN_TAVERN_QUIZ_TABLE_POSITION } from "@blockcraft/voxel-world";
import { TAVERN_HIGH_LOW_TABLE_POSITION } from "@blockcraft/protocol";

export const TAVERN_KEEPER = {
  name: "Mara",
  ...TOWN_TAVERN_KEEPER_POSITION,
  talkRange: 2.6,
} as const;

export const TAVERN_KEEPER_LINES = [
  "Welcome to the Hearth & Hammer. I'm Mara. Come in and warm yourself by the fire.",
  "Rest here to restore your strength, or bind the inn as the room you'll return to after defeat.",
  "Today's tower contracts are on the board. They rotate, so check them before every climb.",
  "Fancy a wager? The red-felt Higher or Lower table is in the eastern dining corner.",
] as const;

export const TAVERN_QUIZ_TABLE = { ...TOWN_TAVERN_QUIZ_TABLE_POSITION, interactRange: 2.6 } as const;
export const TAVERN_ROOM_KEEPER = { name: "Mara", x: -8.2, y: 9.5, z: -1.5, talkRange: 2.8 } as const;
export const TAVERN_HIGH_LOW_TABLE = { ...TAVERN_HIGH_LOW_TABLE_POSITION, interactRange: 2.8 } as const;

export function canPlayHigherOrLower(player: { x: number; y: number; z: number }, tavernVisible: boolean): boolean {
  return tavernVisible
    && Math.abs(player.y - TAVERN_HIGH_LOW_TABLE.y) <= 1.6
    && Math.hypot(player.x - TAVERN_HIGH_LOW_TABLE.x, player.z - TAVERN_HIGH_LOW_TABLE.z) <= TAVERN_HIGH_LOW_TABLE.interactRange;
}

export function canPlayAtTavernTable(player: { x: number; y: number; z: number }, tavernVisible: boolean,
  table: typeof TAVERN_QUIZ_TABLE = TAVERN_QUIZ_TABLE): boolean {
  return tavernVisible
    && Math.abs(player.y - table.y) <= 1.6
    && Math.hypot(player.x - table.x, player.z - table.z) <= table.interactRange;
}

export function canTalkToTavernKeeper(
  player: { x: number; y: number; z: number },
  keeperVisible: boolean,
  keeper: typeof TAVERN_KEEPER | typeof TAVERN_ROOM_KEEPER = TAVERN_KEEPER,
): boolean {
  return keeperVisible
    && Math.abs(player.y - keeper.y) <= 1.6
    && Math.hypot(player.x - keeper.x, player.z - keeper.z) <= keeper.talkRange;
}
