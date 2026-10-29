export type InteractionMode = "build" | "combat";
export type PrimaryAction = "mine" | "attack";

export function primaryActionForMode(mode: InteractionMode): PrimaryAction {
  return mode === "build" ? "mine" : "attack";
}

export function alternateInteractionMode(mode: InteractionMode): InteractionMode {
  return mode === "build" ? "combat" : "build";
}

/** Combat destinations must not inherit the peaceful town's build controls. */
export function portalArrivalInteractionMode(mode: InteractionMode, entering: boolean): InteractionMode {
  return entering ? "combat" : mode;
}
