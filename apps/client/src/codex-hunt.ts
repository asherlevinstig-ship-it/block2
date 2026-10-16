import {
  FOREST_PORTAL_POSITION,
  GREENWOOD_CRAWLER_HOMES,
  MISTFEN_BEHEMOTH_HOME,
  SILVER_GUARD_HOMES,
  STONE_BRUTE_ARENA_HOME,
  TOWN_BLACKSMITH_STALL_POSITION,
  TOWN_EXPEDITION_BOARD_POSITION,
  TOWN_SILVER_DEPTHS_PORTAL_POSITION,
} from "@blockcraft/voxel-world";
import { HUNT_EQUIPMENT_SETS, type ItemId } from "@blockcraft/protocol";

export type CodexHuntPlan = {
  itemId: ItemId;
  source: string;
  level: string;
  protection: string;
  target: { x: number; y: number; z: number; id: string; name: string };
};

const waypoint = (point: { x: number; y: number; z: number }, id: string, name: string) => ({ ...point, id, name });
const smith = waypoint(TOWN_BLACKSMITH_STALL_POSITION, "codex-smith", "Blacksmith · equipment source");
const huntBoard = waypoint(TOWN_EXPEDITION_BOARD_POSITION, "codex-hunt-board", "Realm Hunt Board · equipment contracts");
const depths = waypoint(TOWN_SILVER_DEPTHS_PORTAL_POSITION, "codex-depths", "Silver Depths · equipment route");
const forest = waypoint(FOREST_PORTAL_POSITION, "codex-forest", "Forest Dungeon · equipment source");

export const CODEX_HUNT_PLANS: Partial<Record<ItemId, CodexHuntPlan>> = {
  forged_sword: { itemId: "forged_sword", source: "Town Blacksmith", level: "LV 1+", protection: "Always available once its smithing requirement is met", target: smith },
  forged_bow: { itemId: "forged_bow", source: "Town Blacksmith", level: "LV 1+", protection: "Always available once its smithing requirement is met", target: smith },
  forged_focus: { itemId: "forged_focus", source: "Town Blacksmith", level: "LV 1+", protection: "Always available once its smithing requirement is met", target: smith },
  leather_armour: { itemId: "leather_armour", source: "Town Blacksmith", level: "LV 1+", protection: "Always available from the armour shop", target: smith },
  iron_armour: { itemId: "iron_armour", source: "Town Blacksmith", level: "LV 5+", protection: "Always available after Advanced Smithing", target: smith },
  fang_dagger: { itemId: "fang_dagger", source: "Mossback Alpha", level: "LV 2–5", protection: "Guaranteed in the area leader's personal cache", target: waypoint(GREENWOOD_CRAWLER_HOMES[0], "codex-fang", "Mossback Alpha · Fang Dagger") },
  acid_gland_focus: { itemId: "acid_gland_focus", source: "Silverfang Spitter", level: "LV 4–8", protection: "Guaranteed in the area leader's personal cache", target: waypoint(SILVER_GUARD_HOMES[1], "codex-acid", "Silverfang Spitter · Acid Focus") },
  stone_core_hammer: { itemId: "stone_core_hammer", source: "Stonehide Crusher", level: "LV 5–9", protection: "Guaranteed in the area leader's personal cache", target: waypoint(STONE_BRUTE_ARENA_HOME, "codex-hammer", "Stonehide Crusher · Core Hammer") },
  rootbound_hammer: { itemId: "rootbound_hammer", source: "Ancient Root Guardian", level: "LV 6–10", protection: "Personal dungeon equipment reward", target: forest },
  rootguard_armour: { itemId: "rootguard_armour", source: "Ancient Root Guardian", level: "LV 6–10", protection: "Personal dungeon equipment reward", target: forest },
  matriarch_edge: { itemId: "matriarch_edge", source: "Crystal Matriarch", level: "LV 7–12", protection: "First victory guarantees this signature weapon", target: depths },
  echo_prism: { itemId: "echo_prism", source: "Silver Echo route", level: "LV 7–12", protection: "Fixed personal route reward", target: depths },
  bastion_plate: { itemId: "bastion_plate", source: "Iron Bastion route", level: "LV 7–12", protection: "Fixed personal route reward", target: depths },
  venom_focus: { itemId: "venom_focus", source: "Venom Matriarch", level: "LV 5–9", protection: "First victory guarantees this signature focus", target: waypoint(GREENWOOD_CRAWLER_HOMES[1], "codex-venom", "Venom Matriarch · signature focus") },
  fangstalker_wrap: { itemId: "fangstalker_wrap", source: "Veteran Fang Hunt", level: "LV 8+", protection: "Armour protection improves across repeated Fang Hunts", target: huntBoard },
  venomweave_mantle: { itemId: "venomweave_mantle", source: "Veteran Venom Hunt", level: "LV 8+", protection: "Armour protection improves across repeated Venom Hunts", target: huntBoard },
  worldsplitter_plate: { itemId: "worldsplitter_plate", source: "Veteran Crusher Hunt", level: "LV 8+", protection: "Armour protection improves across repeated Crusher Hunts", target: huntBoard },
  mirebreaker_mantle: { itemId: "mirebreaker_mantle", source: "Empowered Mireback Behemoth", level: "LV 7–10", protection: "Regional mastery unlocks its Legendary drop chance", target: waypoint(MISTFEN_BEHEMOTH_HOME, "codex-mirebreaker", "Mireback Behemoth · Legendary mantle") },
  rootstalker_wrap: { itemId: "rootstalker_wrap", source: "Empowered Greenwood Broodmother", level: "LV 6–9", protection: "Regional mastery unlocks its Legendary drop chance", target: waypoint(GREENWOOD_CRAWLER_HOMES[1], "codex-rootstalker", "Greenwood Broodmother · Legendary wrap") },
};

export function codexHuntPlan(itemId: ItemId): CodexHuntPlan | null {
  return CODEX_HUNT_PLANS[itemId] ?? null;
}

export function nextSetPiece(itemId: ItemId): ItemId | null {
  for (const set of Object.values(HUNT_EQUIPMENT_SETS)) {
    if (set.weaponId === itemId) return set.armourId;
    if (set.armourId === itemId) return set.weaponId;
  }
  return null;
}
