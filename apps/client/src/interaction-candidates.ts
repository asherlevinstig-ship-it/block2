import { canInteractWithTownNpc, townNpcDistance, type TownNpcDefinition, type TownNpcId, type TownNpcLocationId } from "@blockcraft/protocol";

export interface InteractionCandidate<T = string> {
  id: string;
  kind: string;
  priority: number;
  distance: number;
  label: string;
  prompt: string;
  hold: boolean;
  payload: T;
}

/** Pick one action for both the visible prompt and the eventual input dispatch. */
export function selectInteractionCandidate<T>(
  candidates: readonly (InteractionCandidate<T> | null | false | undefined)[],
): InteractionCandidate<T> | null {
  return candidates
    .filter((candidate): candidate is InteractionCandidate<T> => Boolean(candidate))
    .sort((left, right) => right.priority - left.priority || left.distance - right.distance || left.id.localeCompare(right.id))[0] ?? null;
}

export function townNpcInteractionCandidate(
  player: Readonly<{ x: number; y: number; z: number }>,
  npc: TownNpcDefinition,
  enabled = true,
  location: TownNpcLocationId = "town",
): InteractionCandidate<TownNpcId> | null {
  if (!enabled || !canInteractWithTownNpc(player, npc, location)) return null;
  return {
    id: `npc:${npc.id}`,
    kind: "town-npc",
    priority: 50,
    distance: townNpcDistance(player, npc, location),
    label: npc.services.includes("blacksmith") ? "Trade" : "Talk",
    prompt: npc.prompt,
    hold: false,
    payload: npc.id as TownNpcId,
  };
}

