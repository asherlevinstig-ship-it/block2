export const SILVER_DEPTHS_COMPLETE_STAGE = 7;

export type SilverDepthsEvent = "briefed" | "entered_depths" | "mined_moonstone" | "defeated_guards" | "defeated_matriarch" | "claimed_moonstone" | "returned_to_blacksmith";

const REQUIRED: Record<SilverDepthsEvent, number> = {
  briefed: 0, entered_depths: 1, mined_moonstone: 2, defeated_guards: 3,
  defeated_matriarch: 4, claimed_moonstone: 5, returned_to_blacksmith: 6,
};

export function advanceSilverDepths(stage: number, event: SilverDepthsEvent): number {
  const current = Math.max(0, Math.min(SILVER_DEPTHS_COMPLETE_STAGE, Math.floor(stage)));
  return current === REQUIRED[event] ? current + 1 : current;
}

export function isInsideSilverDepths(position: { x: number; y: number; z: number }): boolean {
  return position.x >= 60 && position.x <= 76 && position.y <= 4.5 && position.z >= 4 && position.z <= 14;
}

export const SILVER_DEPTHS_GUARDS = ["silver-depths-spitter-a", "silver-depths-spitter-b"] as const;
export const CRYSTAL_MATRIARCH_ID = "crystal-matriarch";
