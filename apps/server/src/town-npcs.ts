import {
  TOWN_NPCS,
  canInteractWithTownNpc,
  type TownNpcId,
  type TownNpcLocationId,
  type TownNpcServiceId,
} from "@blockcraft/protocol";

export type TownNpcInteractionValidation =
  | { ok: true; npcId: TownNpcId; service: TownNpcServiceId }
  | { ok: false; reason: "unknown-service" | "too-far" };

/**
 * Shared server gate for every functional Town NPC. Domain systems still own
 * prices, rewards and mutations; this layer owns identity, service membership
 * and authoritative proximity.
 */
export function validateTownNpcInteraction(
  player: Readonly<{ x: number; y: number; z: number }>,
  npcId: TownNpcId,
  service: TownNpcServiceId,
  location: TownNpcLocationId = "town",
): TownNpcInteractionValidation {
  const npc = TOWN_NPCS[npcId];
  if (!(npc.services as readonly TownNpcServiceId[]).includes(service)) return { ok: false, reason: "unknown-service" };
  if (!canInteractWithTownNpc(player, npc, location)) return { ok: false, reason: "too-far" };
  return { ok: true, npcId, service };
}

