import {
  ITEM_DEFINITIONS,
  HEALING_POTION,
  MAIN_HAND_DEFINITIONS,
  POWER_DEFINITIONS,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  TRAIT_DEFINITIONS,
  TAVERN_QUIZ_STARTING_COINS,
  type ItemId,
  type MainHandId,
  type PowerId,
  type SeismicMasteryId,
  type SpecialId,
  type TraitId,
} from "@blockcraft/protocol";
import { canEquipMainHand } from "./equipment-rules.js";
import { ArmourEquipSchema, type ArmourId } from "@blockcraft/protocol";
import { compatiblePowerOrFallback } from "./power-rules.js";
import { InventoryItemState, type PlayerState } from "./schema.js";

export const PLAYER_SAVE_VERSION = 1;
export const PLAYER_SAVE_HASH = "blockcraft:player-saves:v1";

export interface PlayerSaveData {
  version: typeof PLAYER_SAVE_VERSION;
  savedAt: number;
  name: string;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  coins: number;
  potionCooldownUntil?: number;
  blacksmithUpgrades: number;
  inventory: Partial<Record<ItemId, number>>;
  mainHandId: MainHandId;
  armourId?: ArmourId;
  equippedPower: PowerId;
  seismicMastery: SeismicMasteryId;
  equippedSpecial: SpecialId;
  equippedTrait: TraitId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function isKeyOf<T extends object>(value: unknown, record: T): value is Extract<keyof T, string> {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(record, value);
}

export function snapshotPlayerSave(player: PlayerState, now = Date.now()): PlayerSaveData {
  const inventory: Partial<Record<ItemId, number>> = {};
  for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const quantity = player.inventory.get(itemId)?.quantity ?? 0;
    if (quantity > 0) inventory[itemId] = Math.min(65_535, Math.floor(quantity));
  }
  return {
    version: PLAYER_SAVE_VERSION,
    savedAt: now,
    name: player.name,
    health: player.health,
    maxHealth: player.maxHealth,
    stamina: player.stamina,
    maxStamina: player.maxStamina,
    coins: player.coins,
    potionCooldownUntil: player.potionCooldownUntil,
    blacksmithUpgrades: player.blacksmithUpgrades,
    inventory,
    mainHandId: player.mainHandId as MainHandId,
    armourId: ArmourEquipSchema.safeParse({ armourId: player.armourId }).data?.armourId ?? "none",
    equippedPower: player.equippedPower as PowerId,
    seismicMastery: player.seismicMastery as SeismicMasteryId,
    equippedSpecial: player.equippedSpecial as SpecialId,
    equippedTrait: player.equippedTrait as TraitId,
  };
}

export function serializePlayerSave(player: PlayerState, now = Date.now()): string {
  return JSON.stringify(snapshotPlayerSave(player, now));
}

export function parsePlayerSave(raw: string | null): PlayerSaveData | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.version !== PLAYER_SAVE_VERSION) return null;

  const inventory: Partial<Record<ItemId, number>> = {};
  if (isRecord(value.inventory)) {
    for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
      const quantity = value.inventory[itemId];
      if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) {
        inventory[itemId] = Math.min(itemId === "healing_potion" ? HEALING_POTION.capacity : 65_535, quantity);
      }
    }
  }
  const maxHealth = Math.floor(finiteNumber(value.maxHealth, 5, 1, 127));
  const maxStamina = finiteNumber(value.maxStamina, 100, 1, 10_000);
  const mainHandId = isKeyOf(value.mainHandId, MAIN_HAND_DEFINITIONS) ? value.mainHandId : "longsword";
  const mainHand = MAIN_HAND_DEFINITIONS[mainHandId];
  const equippedPower = isKeyOf(value.equippedPower, POWER_DEFINITIONS)
    ? compatiblePowerOrFallback(value.equippedPower, mainHand.tag)
    : "shockwave";

  return {
    version: PLAYER_SAVE_VERSION,
    savedAt: finiteNumber(value.savedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    name: typeof value.name === "string" ? value.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 20) || "Explorer" : "Explorer",
    health: Math.floor(finiteNumber(value.health, maxHealth, 1, maxHealth)),
    maxHealth,
    stamina: finiteNumber(value.stamina, maxStamina, 0, maxStamina),
    maxStamina,
    coins: Math.floor(finiteNumber(value.coins, TAVERN_QUIZ_STARTING_COINS, 0, 1_000_000)),
    potionCooldownUntil: finiteNumber(value.potionCooldownUntil, 0, 0, Number.MAX_SAFE_INTEGER),
    blacksmithUpgrades: Math.floor(finiteNumber(value.blacksmithUpgrades, 0, 0, 7)),
    inventory,
    mainHandId,
    armourId: ArmourEquipSchema.safeParse({ armourId: value.armourId }).data?.armourId ?? "none",
    equippedPower,
    seismicMastery: isKeyOf(value.seismicMastery, SEISMIC_CLEAVE_UPGRADES.masteries) ? value.seismicMastery : "advancing_fault",
    equippedSpecial: isKeyOf(value.equippedSpecial, SPECIAL_DEFINITIONS) ? value.equippedSpecial : "hunters_mark",
    equippedTrait: isKeyOf(value.equippedTrait, TRAIT_DEFINITIONS) ? value.equippedTrait : "momentum",
  };
}

export function applyPlayerSave(player: PlayerState, save: PlayerSaveData): void {
  player.name = save.name;
  player.maxHealth = save.maxHealth;
  player.health = save.health;
  player.maxStamina = save.maxStamina;
  player.coins = save.coins;
  player.potionCooldownUntil = save.potionCooldownUntil ?? 0;
  player.blacksmithUpgrades = save.blacksmithUpgrades;
  player.stamina = save.stamina;
  for (const [itemId, quantity] of Object.entries(save.inventory) as [ItemId, number][]) {
    const item = new InventoryItemState();
    item.quantity = quantity;
    player.inventory.set(itemId, item);
  }
  const mainHandId = canEquipMainHand(save.mainHandId, itemId => player.inventory.get(itemId)?.quantity ?? 0)
    ? save.mainHandId
    : "longsword";
  const mainHand = MAIN_HAND_DEFINITIONS[mainHandId];
  player.mainHandId = mainHandId;
  player.mainHandTag = mainHand.tag;
  player.armourId = save.armourId && (save.armourId === "none" || (player.inventory.get(save.armourId)?.quantity ?? 0) > 0) ? save.armourId : "none";
  player.equippedPower = compatiblePowerOrFallback(save.equippedPower, mainHand.tag);
  player.seismicMastery = save.seismicMastery;
  player.equippedSpecial = save.equippedSpecial;
  player.equippedTrait = save.equippedTrait;
}
