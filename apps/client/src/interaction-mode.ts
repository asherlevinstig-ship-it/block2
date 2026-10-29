export type InteractionMode = "build" | "combat";
export type PrimaryAction = "mine" | "attack";
export const ACTIVE_GAME_INTERACTION_MODE: InteractionMode = "combat";

export function primaryActionForMode(mode: InteractionMode): PrimaryAction {
  return mode === "build" ? "mine" : "attack";
}
