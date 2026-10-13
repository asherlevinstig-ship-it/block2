export const MINING_EXPEDITION_COMPLETE_STAGE = 8;

export type MiningExpeditionEvent =
  | "briefed"
  | "entered_mine"
  | "mined_iron"
  | "mined_silver"
  | "breached_vault"
  | "defeated_warden"
  | "claimed_lantern"
  | "returned_to_blacksmith";

const REQUIRED_STAGE: Record<MiningExpeditionEvent, number> = {
  briefed: 0,
  entered_mine: 1,
  mined_iron: 2,
  mined_silver: 3,
  breached_vault: 4,
  defeated_warden: 5,
  claimed_lantern: 6,
  returned_to_blacksmith: 7,
};

export function advanceMiningExpedition(stage: number, event: MiningExpeditionEvent): number {
  const current = Math.max(0, Math.min(MINING_EXPEDITION_COMPLETE_STAGE, Math.floor(stage)));
  // Claiming the Warden's lantern is the completion. There is no quest hand-in.
  if (current === REQUIRED_STAGE.claimed_lantern && event === "claimed_lantern") return MINING_EXPEDITION_COMPLETE_STAGE;
  return current === REQUIRED_STAGE[event] ? current + 1 : current;
}

export function isInsideEastMine(position: { x: number; y: number; z: number }): boolean {
  return position.x >= 34 && position.x <= 60 && position.y <= 4.25 && position.z >= 4 && position.z <= 14;
}

export function isBuriedVaultSeal(x: number, y: number, z: number): boolean {
  return x === 52 && y >= 1 && y <= 3 && z >= 8 && z <= 9;
}

