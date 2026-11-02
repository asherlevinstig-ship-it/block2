export type TownNpcRole = "guard" | "vendor" | "smith" | "healer" | "resident" | "steward" | "curator" | "mentor";
export type TownNpcServiceId = "blacksmith" | "tavern" | "healing" | "guild" | "tower-chronicle" | "calling" | "quartermaster" | "tower-gate";
export type TownNpcLocationId = "town" | "tavern";

export interface TownNpcLocation {
  anchor: Readonly<{ x: number; y: number; z: number }>;
  interactionRadius?: number;
  verticalRange?: number;
}

export interface TownNpcDefinition {
  id: string;
  name: string;
  title: string;
  role: TownNpcRole;
  anchor: Readonly<{ x: number; y: number; z: number }>;
  interactionRadius: number;
  verticalRange: number;
  services: readonly TownNpcServiceId[];
  prompt: string;
  locations?: Readonly<Partial<Record<TownNpcLocationId, TownNpcLocation>>>;
}

/**
 * Authoritative content registry for Town of Beginnings service NPCs.
 *
 * Visuals, client prompts, map markers and server validation must resolve an
 * NPC through this registry instead of copying its position into each system.
 * Ambient-only residents can remain in the client town-life roster until they
 * acquire a service or persistent dialogue.
 */
export const TOWN_NPCS = {
  "smith-brom": {
    id: "smith-brom",
    name: "Brom",
    title: "Beginning Smith",
    role: "smith",
    anchor: { x: 79, y: 8, z: 136 },
    interactionRadius: 2.6,
    verticalRange: 1.6,
    services: ["blacksmith"],
    prompt: "Trade or forge",
  },
  mara: {
    id: "mara",
    name: "Mara",
    title: "Innkeeper",
    role: "vendor",
    anchor: { x: 5.1, y: 8, z: 24.35 },
    interactionRadius: 2.6,
    verticalRange: 1.6,
    services: ["tavern", "healing"],
    prompt: "Rest and prepare",
    locations: {
      town: { anchor: { x: 5.1, y: 8, z: 24.35 } },
      tavern: { anchor: { x: -8.2, y: 9.5, z: -1.5 }, interactionRadius: 2.8, verticalRange: 1.8 },
    },
  },
  "healer-lyra": {
    id: "healer-lyra",
    name: "Lyra",
    title: "Sanctuary Healer",
    role: "healer",
    anchor: { x: 51, y: 8, z: 108.5 },
    interactionRadius: 2.8,
    verticalRange: 1.6,
    services: ["healing", "calling"],
    prompt: "Receive care and guidance",
  },
  "guild-steward-elin": {
    id: "guild-steward-elin",
    name: "Elin",
    title: "Guild Steward",
    role: "steward",
    anchor: { x: 55, y: 9.45, z: 73 },
    interactionRadius: 3,
    verticalRange: 2,
    services: ["guild"],
    prompt: "Manage your guild",
  },
} as const satisfies Record<string, TownNpcDefinition>;

export type TownNpcId = keyof typeof TOWN_NPCS;

export const TownNpcInteractionRequestSchema = z.object({
  npcId: z.enum(["smith-brom", "mara", "healer-lyra", "guild-steward-elin"]),
  action: z.enum(["care", "guild"]),
}).strict();
export type TownNpcInteractionRequest = z.infer<typeof TownNpcInteractionRequestSchema>;
export type TownNpcInteractionUpdate = {
  npcId: TownNpcId;
  action: TownNpcInteractionRequest["action"];
  ok: boolean;
  message: string;
  health?: number;
  maxHealth?: number;
  stamina?: number;
  maxStamina?: number;
  practiceCalling?: "healer";
  openPanel?: "guild";
};

export function townNpcDefinition(id: TownNpcId): TownNpcDefinition {
  return TOWN_NPCS[id];
}

export function townNpcDistance(
  player: Readonly<{ x: number; y: number; z: number }>,
  npc: TownNpcDefinition,
  location: TownNpcLocationId = "town",
): number {
  const resolved = townNpcLocation(npc, location);
  return Math.hypot(player.x - resolved.anchor.x, player.z - resolved.anchor.z);
}

export function townNpcLocation(
  npc: TownNpcDefinition,
  location: TownNpcLocationId = "town",
): Required<TownNpcLocation> {
  const override = npc.locations?.[location];
  return {
    anchor: override?.anchor ?? npc.anchor,
    interactionRadius: override?.interactionRadius ?? npc.interactionRadius,
    verticalRange: override?.verticalRange ?? npc.verticalRange,
  };
}

export function canInteractWithTownNpc(
  player: Readonly<{ x: number; y: number; z: number }>,
  npc: TownNpcDefinition,
  location: TownNpcLocationId = "town",
): boolean {
  const resolved = townNpcLocation(npc, location);
  return Math.abs(player.y - resolved.anchor.y) <= resolved.verticalRange
    && townNpcDistance(player, npc, location) <= resolved.interactionRadius;
}

import { z } from "zod";

