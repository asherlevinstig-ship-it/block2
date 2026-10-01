export type InteractionMode = "build" | "combat";
export type PrimaryAction = "mine" | "attack";

export function primaryActionForMode(mode: InteractionMode): PrimaryAction {
  return mode === "build" ? "mine" : "attack";
}

export function alternateInteractionMode(mode: InteractionMode): InteractionMode {
  return mode === "build" ? "combat" : "build";
}
